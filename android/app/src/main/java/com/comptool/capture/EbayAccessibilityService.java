package com.comptool.capture;

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class EbayAccessibilityService extends AccessibilityService {

    public static boolean isRunning = false;
    private static final String API_URL = "https://listflow.robug.com/comp/api/ingest";
    private static final Pattern PRICE_PATTERN = Pattern.compile("\\$([\\d,]+\\.?\\d*)");
    private static final Pattern SOLD_PATTERN = Pattern.compile("Sold\\s+(\\w+\\s+\\d+[, ]*\\d{0,4})", Pattern.CASE_INSENSITIVE);

    private Set<String> seenItems = new HashSet<>();
    private List<String[]> pendingItems = new ArrayList<>(); // [title, price, condition, date]
    private long lastSendTime = 0;
    private static final long SEND_INTERVAL = 10000; // batch send every 10 seconds

    @Override
    public void onServiceConnected() {
        isRunning = true;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return;

        try {
            // Look for sold listing patterns in the view tree
            extractSoldItems(root);

            // Batch send if we have pending items and enough time has passed
            long now = System.currentTimeMillis();
            if (!pendingItems.isEmpty() && (now - lastSendTime > SEND_INTERVAL)) {
                sendBatch();
                lastSendTime = now;
            }
        } finally {
            root.recycle();
        }
    }

    private void extractSoldItems(AccessibilityNodeInfo node) {
        if (node == null) return;

        // Collect all text from the node tree
        String text = getNodeText(node);

        // Look for sold item patterns:
        // eBay app shows: Title \n Price \n "Sold [date]" \n Condition
        // We scan for price + "Sold" indicators
        if (text != null && text.length() > 10) {
            // Check if this looks like a sold listing card
            boolean hasSold = text.toLowerCase().contains("sold");
            boolean hasPrice = PRICE_PATTERN.matcher(text).find();

            if (hasSold && hasPrice) {
                parseSoldCard(text);
            }
        }

        // Recurse into children
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                // Look for list items / card containers
                String className = child.getClassName() != null ? child.getClassName().toString() : "";
                if (className.contains("RecyclerView") || className.contains("ListView") ||
                    className.contains("ViewGroup") || className.contains("FrameLayout")) {
                    // Check individual children (each card)
                    for (int j = 0; j < child.getChildCount(); j++) {
                        AccessibilityNodeInfo card = child.getChild(j);
                        if (card != null) {
                            String cardText = getAllText(card);
                            if (cardText != null && cardText.toLowerCase().contains("sold") && PRICE_PATTERN.matcher(cardText).find()) {
                                parseSoldCard(cardText);
                            }
                            card.recycle();
                        }
                    }
                }
                child.recycle();
            }
        }
    }

    private String getNodeText(AccessibilityNodeInfo node) {
        if (node.getText() != null) return node.getText().toString();
        if (node.getContentDescription() != null) return node.getContentDescription().toString();
        return null;
    }

    private String getAllText(AccessibilityNodeInfo node) {
        StringBuilder sb = new StringBuilder();
        collectText(node, sb);
        return sb.toString();
    }

    private void collectText(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null) return;
        if (node.getText() != null) {
            sb.append(node.getText()).append("\n");
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectText(child, sb);
                child.recycle();
            }
        }
    }

    private void parseSoldCard(String text) {
        String[] lines = text.split("\n");
        String title = null;
        String price = null;
        String condition = null;
        String soldDate = null;

        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty()) continue;

            // Skip known non-data lines
            if (line.equals("Sold") || line.startsWith("View similar") ||
                line.startsWith("Sell one") || line.startsWith("Shop on eBay")) continue;

            // Price
            Matcher pm = PRICE_PATTERN.matcher(line);
            if (pm.find() && price == null && !line.contains("shipping") && !line.contains("delivery")) {
                price = pm.group(1).replace(",", "");
            }

            // Sold date
            Matcher dm = SOLD_PATTERN.matcher(line);
            if (dm.find()) {
                soldDate = dm.group(1);
            }

            // Condition keywords
            if (line.equals("Pre-Owned") || line.equals("Brand New") || line.equals("New") ||
                line.startsWith("New (") || line.equals("Parts Only") || line.equals("Open Box") ||
                line.contains("Refurbished")) {
                condition = line;
            }

            // Title — longest non-price, non-date line is probably the title
            if (title == null && line.length() > 15 && !pm.find() && !line.startsWith("$") &&
                !line.toLowerCase().contains("sold") && !line.toLowerCase().contains("shipping")) {
                title = line;
            }
        }

        // Fallback title: first long line
        if (title == null) {
            for (String line : lines) {
                if (line.trim().length() > 15) {
                    title = line.trim();
                    break;
                }
            }
        }

        if (title != null && price != null) {
            // Dedup by title+price
            String key = title.substring(0, Math.min(30, title.length())) + "|" + price;
            if (!seenItems.contains(key)) {
                seenItems.add(key);
                pendingItems.add(new String[]{title, price, condition, soldDate});
            }
        }
    }

    private void sendBatch() {
        if (pendingItems.isEmpty()) return;

        SharedPreferences prefs = getSharedPreferences("comptool", MODE_PRIVATE);
        String apiKey = prefs.getString("api_key", "");
        if (apiKey.isEmpty()) return;

        // Build JSON
        StringBuilder json = new StringBuilder();
        json.append("{\"keyword\":\"ebay-app-capture\",\"source\":\"android-app\",\"items\":[");

        boolean first = true;
        for (String[] item : pendingItems) {
            if (!first) json.append(",");
            first = false;

            String title = item[0].replace("\"", "\\\"").replace("\n", " ");
            String price = item[1];
            String condition = item[2] != null ? item[2].replace("\"", "\\\"") : null;
            String soldDate = item[3];

            // Generate a pseudo item ID from title hash
            String itemId = "app-" + Math.abs(title.hashCode()) + "-" + price.replace(".", "");

            json.append("{");
            json.append("\"ebayItemId\":\"").append(itemId).append("\",");
            json.append("\"title\":\"").append(title).append("\",");
            json.append("\"soldPrice\":").append(price).append(",");
            json.append("\"totalPrice\":").append(price);
            if (condition != null) {
                json.append(",\"condition\":\"").append(condition).append("\"");
            }
            if (soldDate != null) {
                json.append(",\"soldDate\":\"").append(soldDate).append("\"");
            }
            json.append("}");
        }
        json.append("]}");

        int count = pendingItems.size();
        pendingItems.clear();

        // Send in background thread
        final String payload = json.toString();
        final String key = apiKey;
        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(API_URL).openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("X-API-Key", key);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                OutputStream os = conn.getOutputStream();
                os.write(payload.getBytes(StandardCharsets.UTF_8));
                os.close();

                int code = conn.getResponseCode();
                if (code == 200) {
                    // Update count in prefs
                    SharedPreferences p = getSharedPreferences("comptool", MODE_PRIVATE);
                    int total = p.getInt("capture_count", 0) + count;
                    p.edit().putInt("capture_count", total).apply();
                }
                conn.disconnect();
            } catch (Exception e) {
                // Silently fail — will retry with next batch
            }
        }).start();
    }

    @Override
    public void onInterrupt() {
        isRunning = false;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        // Send any remaining items
        if (!pendingItems.isEmpty()) {
            sendBatch();
        }
        super.onDestroy();
    }
}
