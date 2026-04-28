# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

require "bigdecimal"

def seed_pool_snapshot_history!(network_id:, pool_address:, rows:)
  canonical_pool_address = pool_address.downcase

  PoolSnapshot.where(
    network_id: network_id,
    pool_address: canonical_pool_address,
  ).delete_all

  rows.each do |attributes|
    PoolSnapshot.create!(
      {
        network_id: network_id,
        pool_address: canonical_pool_address,
      }.merge(attributes),
    )
  end
end

if ENV["SEED_SAMPLE_POOL_HISTORY"] == "1"
  now = Time.current.change(usec: 0)

  seed_pool_snapshot_history!(
    network_id: "base",
    pool_address: "0x6c561b446416e1a00e8e93e221854d6ea4171372",
    rows: [
      {
        captured_at: now - 23.hours,
        liquidity_usd: BigDecimal("3210000"),
        volume_24h_usd: BigDecimal("654321"),
        transactions_24h: 111,
      },
      {
        captured_at: now - 12.hours,
        liquidity_usd: BigDecimal("3765000"),
        volume_24h_usd: BigDecimal("700000"),
        transactions_24h: 180,
      },
      {
        captured_at: now,
        liquidity_usd: BigDecimal("4321000"),
        volume_24h_usd: BigDecimal("765432"),
        transactions_24h: 222,
      },
    ],
  )

  puts "Seeded sample pool history for base/0x6c561b446416e1a00e8e93e221854d6ea4171372"
end

if ENV["SEED_DEMO_USER"] == "1"
  demo_email = ENV.fetch("DEMO_USER_EMAIL", "demo@cryptdash.local").strip.downcase
  demo_password = ENV.fetch("DEMO_USER_PASSWORD", "password123")

  demo_user = User.find_or_initialize_by(email: demo_email)
  demo_user.password = demo_password
  demo_user.password_confirmation = demo_password
  demo_user.save!

  [
    {
      coin_id: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
      thumb_url: "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png"
    },
    {
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      thumb_url: "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png"
    }
  ].each do |attributes|
    demo_user.watchlist_items.find_or_create_by!(coin_id: attributes[:coin_id]) do |item|
      item.name = attributes[:name]
      item.symbol = attributes[:symbol]
      item.thumb_url = attributes[:thumb_url]
    end
  end

  puts "Seeded demo user #{demo_user.email} with #{demo_user.watchlist_items.count} watchlist items"
end
