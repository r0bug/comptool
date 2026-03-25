package com.comptool.capture;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private EditText apiKeyInput;
    private TextView statusText;
    private TextView captureCount;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        apiKeyInput = findViewById(R.id.apiKeyInput);
        statusText = findViewById(R.id.statusText);
        captureCount = findViewById(R.id.captureCount);

        // Load saved API key
        SharedPreferences prefs = getSharedPreferences("comptool", MODE_PRIVATE);
        String savedKey = prefs.getString("api_key", "");
        if (!savedKey.isEmpty()) {
            apiKeyInput.setText(savedKey);
        }

        // Save key button
        Button saveBtn = findViewById(R.id.saveKeyBtn);
        saveBtn.setOnClickListener(v -> {
            String key = apiKeyInput.getText().toString().trim();
            if (key.isEmpty()) {
                Toast.makeText(this, "Enter an API key", Toast.LENGTH_SHORT).show();
                return;
            }
            prefs.edit().putString("api_key", key).apply();
            Toast.makeText(this, "API key saved!", Toast.LENGTH_SHORT).show();
        });

        // Open accessibility settings
        Button settingsBtn = findViewById(R.id.openSettingsBtn);
        settingsBtn.setOnClickListener(v -> {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            startActivity(intent);
        });

        updateStatus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatus();
    }

    private void updateStatus() {
        SharedPreferences prefs = getSharedPreferences("comptool", MODE_PRIVATE);
        int count = prefs.getInt("capture_count", 0);
        captureCount.setText("Comps captured this session: " + count);

        boolean serviceRunning = EbayAccessibilityService.isRunning;
        statusText.setText("Status: " + (serviceRunning ? "Running - monitoring eBay app" : "Not running"));
        statusText.setTextColor(serviceRunning ? 0xFF4CAF50 : 0xFF888888);
    }
}
