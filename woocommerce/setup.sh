#!/bin/bash

# Reset Biology WooCommerce Setup Script
# This automates the entire WordPress + WooCommerce installation

echo "🚀 Reset Biology WooCommerce Store Setup"
echo "========================================"

# Wait for WordPress to be ready
echo "⏳ Waiting for WordPress to be ready..."
sleep 20

# Install WordPress
echo "📦 Installing WordPress..."
docker exec resetbiology_woo_cli wp core install \
  --url="http://localhost:8080" \
  --title="Reset Biology Store" \
  --admin_user="admin" \
  --admin_password="ResetBiology2024!" \
  --admin_email="jon@resetbiology.com" \
  --skip-email \
  --allow-root

# Install WooCommerce
echo "🛍️  Installing WooCommerce plugin..."
docker exec resetbiology_woo_cli wp plugin install woocommerce --activate --allow-root

# Install Stripe Gateway
echo "💳 Installing Stripe payment gateway..."
docker exec resetbiology_woo_cli wp plugin install woocommerce-gateway-stripe --activate --allow-root

# Install lightweight theme
echo "🎨 Installing Astra theme..."
docker exec resetbiology_woo_cli wp theme install astra --activate --allow-root

# Install SEO plugin
echo "🔍 Installing Yoast SEO..."
docker exec resetbiology_woo_cli wp plugin install wordpress-seo --activate --allow-root

# Configure WooCommerce basics
echo "⚙️  Configuring WooCommerce settings..."
docker exec resetbiology_woo_cli wp option update woocommerce_store_address "123 Wellness Blvd" --allow-root
docker exec resetbiology_woo_cli wp option update woocommerce_store_city "Health City" --allow-root
docker exec resetbiology_woo_cli wp option update woocommerce_default_country "US:CA" --allow-root
docker exec resetbiology_woo_cli wp option update woocommerce_currency "USD" --allow-root
docker exec resetbiology_woo_cli wp option update woocommerce_calc_taxes "no" --allow-root

# Set permalinks to SEO-friendly
echo "🔗 Setting permalinks..."
docker exec resetbiology_woo_cli wp rewrite structure '/%postname%/' --allow-root

# Create product categories
echo "📁 Creating product categories..."
docker exec resetbiology_woo_cli wp term create product_cat "Protocol Packages" --slug="protocol-packages" --allow-root
docker exec resetbiology_woo_cli wp term create product_cat "Single Peptides" --slug="single-peptides" --allow-root
docker exec resetbiology_woo_cli wp term create product_cat "Fat Loss" --slug="fat-loss" --allow-root
docker exec resetbiology_woo_cli wp term create product_cat "Healing & Recovery" --slug="healing-recovery" --allow-root
docker exec resetbiology_woo_cli wp term create product_cat "Longevity" --slug="longevity" --allow-root
docker exec resetbiology_woo_cli wp term create product_cat "Performance" --slug="performance" --allow-root

echo "✅ WordPress + WooCommerce installation complete!"
echo ""
echo "🌐 Access your store:"
echo "   Storefront: http://localhost:8080"
echo "   Admin:      http://localhost:8080/wp-admin"
echo "   Username:   admin"
echo "   Password:   ResetBiology2024!"
echo ""
echo "📦 Next step: Import products with 'npm run woo:import'"
