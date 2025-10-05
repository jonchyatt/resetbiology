#!/bin/bash

# Reset Biology WooCommerce Setup Script
# This automates the entire WordPress + WooCommerce installation

echo "🚀 Reset Biology WooCommerce Store Setup"
echo "========================================"

# Wait for WordPress to be ready
echo "⏳ Waiting for WordPress to be ready..."
sleep 30

# Install WordPress
echo "📦 Installing WordPress..."
docker exec -u www-data resetbiology_woo_wp wp core install \
  --url="http://localhost:8080" \
  --title="Reset Biology Store" \
  --admin_user="admin" \
  --admin_password="ResetBiology2024!" \
  --admin_email="jon@resetbiology.com" \
  --skip-email

# Install WooCommerce
echo "🛍️  Installing WooCommerce plugin..."
docker exec -u www-data resetbiology_woo_wp wp plugin install woocommerce --activate

# Install Stripe Gateway
echo "💳 Installing Stripe payment gateway..."
docker exec -u www-data resetbiology_woo_wp wp plugin install woocommerce-gateway-stripe --activate

# Install lightweight theme
echo "🎨 Installing Astra theme..."
docker exec -u www-data resetbiology_woo_wp wp theme install astra --activate

# Install SEO plugin
echo "🔍 Installing Yoast SEO..."
docker exec -u www-data resetbiology_woo_wp wp plugin install wordpress-seo --activate

# Configure WooCommerce basics
echo "⚙️  Configuring WooCommerce settings..."
docker exec -u www-data resetbiology_woo_wp wp option update woocommerce_store_address "123 Wellness Blvd"
docker exec -u www-data resetbiology_woo_wp wp option update woocommerce_store_city "Health City"
docker exec -u www-data resetbiology_woo_wp wp option update woocommerce_default_country "US:CA"
docker exec -u www-data resetbiology_woo_wp wp option update woocommerce_currency "USD"
docker exec -u www-data resetbiology_woo_wp wp option update woocommerce_calc_taxes "no"

# Set permalinks to SEO-friendly
echo "🔗 Setting permalinks..."
docker exec -u www-data resetbiology_woo_wp wp rewrite structure '/%postname%/'

# Create product categories
echo "📁 Creating product categories..."
docker exec -u www-data resetbiology_woo_wp wp term create product_cat "Protocol Packages" --slug="protocol-packages"
docker exec -u www-data resetbiology_woo_wp wp term create product_cat "Single Peptides" --slug="single-peptides"
docker exec -u www-data resetbiology_woo_wp wp term create product_cat "Fat Loss" --slug="fat-loss"
docker exec -u www-data resetbiology_woo_wp wp term create product_cat "Healing & Recovery" --slug="healing-recovery"
docker exec -u www-data resetbiology_woo_wp wp term create product_cat "Longevity" --slug="longevity"
docker exec -u www-data resetbiology_woo_wp wp term create product_cat "Performance" --slug="performance"

echo "✅ WordPress + WooCommerce installation complete!"
echo ""
echo "🌐 Access your store:"
echo "   Storefront: http://localhost:8080"
echo "   Admin:      http://localhost:8080/wp-admin"
echo "   Username:   admin"
echo "   Password:   ResetBiology2024!"
echo ""
echo "📦 Next step: Import products"
