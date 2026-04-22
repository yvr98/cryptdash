require "test_helper"

class PoolSnapshotTest < ActiveSupport::TestCase
  def build_snapshot(overrides = {})
    PoolSnapshot.new(
      {
        network_id: "ethereum",
        pool_address: "0xAbCdEf1234567890",
        captured_at: Time.zone.parse("2026-04-22 12:00:00 UTC"),
        liquidity_usd: BigDecimal("12345.67"),
        volume_24h_usd: nil,
        transactions_24h: nil
      }.merge(overrides)
    )
  end

  test "schema requires canonical identity fields and keeps metrics nullable" do
    columns = PoolSnapshot.columns_hash

    assert_equal false, columns["network_id"].null
    assert_equal false, columns["pool_address"].null
    assert_equal false, columns["captured_at"].null
    assert_equal true, columns["liquidity_usd"].null
    assert_equal true, columns["volume_24h_usd"].null
    assert_equal true, columns["transactions_24h"].null
  end

  test "schema has unique composite index for identity and capture time" do
    index = ActiveRecord::Base.connection.indexes(:pool_snapshots).find do |candidate|
      candidate.name == "index_pool_snapshots_on_identity_and_captured_at"
    end

    assert_not_nil index
    assert_equal true, index.unique
    assert_equal %w[network_id pool_address captured_at], index.columns
  end

  test "normalizes mixed-case pool addresses before validation" do
    snapshot = build_snapshot(pool_address: "  0xAbCdEfABC123  ")

    assert snapshot.valid?
    assert_equal "0xabcdefabc123", snapshot.pool_address
  end

  test "requires identity fields" do
    snapshot = build_snapshot(network_id: nil, pool_address: nil, captured_at: nil)

    assert_not snapshot.valid?
    assert_includes snapshot.errors[:network_id], "can't be blank"
    assert_includes snapshot.errors[:pool_address], "can't be blank"
    assert_includes snapshot.errors[:captured_at], "can't be blank"
  end

  test "allows persistence when any single metric is present" do
    liquidity_snapshot = build_snapshot(volume_24h_usd: nil, transactions_24h: nil)
    volume_snapshot = build_snapshot(
      captured_at: Time.zone.parse("2026-04-22 12:01:00 UTC"),
      liquidity_usd: nil,
      volume_24h_usd: BigDecimal("987.65"),
      transactions_24h: nil
    )
    transactions_snapshot = build_snapshot(
      captured_at: Time.zone.parse("2026-04-22 12:02:00 UTC"),
      liquidity_usd: nil,
      volume_24h_usd: nil,
      transactions_24h: 42
    )

    assert liquidity_snapshot.valid?
    assert volume_snapshot.valid?
    assert transactions_snapshot.valid?
  end

  test "rejects all-null metric payloads and flags them as non-qualifying" do
    attributes = {
      network_id: "ethereum",
      pool_address: "0xAbCdEf1234567890",
      captured_at: Time.zone.parse("2026-04-22 12:00:00 UTC"),
      liquidity_usd: nil,
      volume_24h_usd: nil,
      transactions_24h: nil
    }
    snapshot = PoolSnapshot.new(attributes)

    assert_equal false, PoolSnapshot.qualifies_for_persistence?(attributes)
    assert_equal false, snapshot.qualifies_for_persistence?
    assert_not snapshot.valid?
    assert_includes snapshot.errors[:base], "at least one metric must be present"
  end

  test "rejects duplicate snapshots after normalization" do
    captured_at = Time.zone.parse("2026-04-22 12:00:00 UTC")

    PoolSnapshot.create!(
      network_id: "ethereum",
      pool_address: "0xabcdef1234567890",
      captured_at: captured_at,
      liquidity_usd: BigDecimal("1000")
    )

    duplicate = build_snapshot(
      pool_address: "0xABCDEF1234567890",
      captured_at: captured_at,
      liquidity_usd: BigDecimal("2000")
    )

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:pool_address], "has already been taken"
  end
end
