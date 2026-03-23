#!/bin/bash
# Add CompTool nginx proxy config
# Run with: sudo bash /home/robug/comptool/setup-nginx.sh

NGINX_CONF="/etc/nginx/sites-available/listflow.robug.com"

# Check if /comp location already exists
if grep -q "location /comp" "$NGINX_CONF"; then
    echo "CompTool nginx config already exists. Skipping."
    nginx -t && systemctl reload nginx
    exit 0
fi

# Insert the /comp block after the /listflow block
sed -i '/location \/listflow {/,/}/ {
    /}/ a\
\
    # CompTool\
    location /comp {\
        proxy_pass http://localhost:3002;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection '\''upgrade'\'';\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
    }
}' "$NGINX_CONF"

# Test config
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "Done! CompTool available at https://list.robug.com/comp/"
else
    echo "Nginx config test failed. Check $NGINX_CONF manually."
    exit 1
fi
