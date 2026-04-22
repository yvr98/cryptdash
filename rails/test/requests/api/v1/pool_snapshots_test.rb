require "test_helper"

class Api::V1::PoolSnapshotsTest < ActionDispatch::IntegrationTest
  SNAPSHOTS_PATH = "/api/v1/pools/ethereum/0xAbCdEf1234567890/snapshots".freeze
  NETWORK_ID = "ethereum".freeze
  CANONICAL_POOL_ADDRESS = "0xabcdef1234567890".freeze
  OTHER_NETWORK_ID = "Ethereum".freeze
  EXPECTED_ROW_KEYS = %w[captured_at liquidity_usd volume_24h_usd transactions_24h].sort.freeze
  INVALID_HOURS_RESPONSE = {
    "error" => "hours must be exactly 24"
  }.freeze

  setup do
    PoolSnapshot.delete_all
  end

  test "GET snapshots with hours=24 returns the public history envelope" do
    get "#{SNAPSHOTS_PATH}?hours=24"

    assert_response :ok
    assert response.content_type.include?("application/json")

    json = JSON.parse(response.body)

    assert_equal %w[row_count rows window_hours].sort, json.keys.sort
    assert_equal 24, json["window_hours"]
    assert_equal 0, json["row_count"]
    assert_equal [], json["rows"]
  end

  test "GET snapshots returns only rows in the trailing 24 hour window with exact boundary semantics" do
    freeze_time do
      now = Time.current

      create_snapshot(captured_at: now - 25.hours, liquidity_usd: BigDecimal("10.0"))
      create_snapshot(captured_at: now - 24.hours, liquidity_usd: BigDecimal("20.0"))
      inside_row = create_snapshot(
        captured_at: now - 24.hours + 1.second,
        liquidity_usd: BigDecimal("30.0"),
        volume_24h_usd: BigDecimal("40.5"),
        transactions_24h: 7
      )
      at_now_row = create_snapshot(
        captured_at: now,
        liquidity_usd: nil,
        volume_24h_usd: BigDecimal("50.25"),
        transactions_24h: nil
      )
      create_snapshot(captured_at: now + 1.second, liquidity_usd: BigDecimal("60.0"))

      get "#{SNAPSHOTS_PATH}?hours=24"

      assert_response :ok

      json = JSON.parse(response.body)

      assert_equal 24, json["window_hours"]
      assert_equal 2, json["row_count"]
      assert_equal [inside_row.captured_at.iso8601, at_now_row.captured_at.iso8601], json["rows"].map { |row| row["captured_at"] }

      first_row = json["rows"].first
      second_row = json["rows"].second

      assert_equal EXPECTED_ROW_KEYS, first_row.keys.sort
      assert_equal "30.0", first_row["liquidity_usd"]
      assert_equal "40.5", first_row["volume_24h_usd"]
      assert_equal 7, first_row["transactions_24h"]

      assert_equal EXPECTED_ROW_KEYS, second_row.keys.sort
      assert_nil second_row["liquidity_usd"]
      assert_equal "50.25", second_row["volume_24h_usd"]
      assert_nil second_row["transactions_24h"]
    end
  end

  test "GET snapshots matches mixed-case pool address while keeping network_id exact" do
    freeze_time do
      now = Time.current

      matching_row = create_snapshot(
        pool_address: CANONICAL_POOL_ADDRESS,
        captured_at: now - 1.hour,
        liquidity_usd: BigDecimal("1000.01")
      )
      create_snapshot(
        network_id: OTHER_NETWORK_ID,
        pool_address: CANONICAL_POOL_ADDRESS,
        captured_at: now - 30.minutes,
        liquidity_usd: BigDecimal("2000.02")
      )

      get "#{SNAPSHOTS_PATH}?hours=24"

      assert_response :ok

      json = JSON.parse(response.body)

      assert_equal 1, json["row_count"]
      assert_equal [matching_row.captured_at.iso8601], json["rows"].map { |row| row["captured_at"] }

      row = json["rows"].first

      assert_equal EXPECTED_ROW_KEYS, row.keys.sort
      assert_equal "1000.01", row["liquidity_usd"]
    end
  end

  test "GET snapshots returns the newest 24 qualifying rows oldest-first when more than 24 qualify" do
    freeze_time do
      now = Time.current

      26.times do |index|
        create_snapshot(
          captured_at: now - (26 - index).minutes,
          liquidity_usd: BigDecimal((index + 1).to_s)
        )
      end

      get "#{SNAPSHOTS_PATH}?hours=24"

      assert_response :ok

      json = JSON.parse(response.body)
      rows = json["rows"]
      captured_at_values = rows.map { |row| row["captured_at"] }

      assert_equal 24, json["row_count"]
      assert_equal captured_at_values.sort, captured_at_values
      assert_equal (now - 24.minutes).iso8601, rows.first["captured_at"]
      assert_equal (now - 1.minute).iso8601, rows.last["captured_at"]
      assert_equal "3.0", rows.first["liquidity_usd"]
      assert_equal "26.0", rows.last["liquidity_usd"]
    end
  end

  test "GET snapshots without hours returns the invalid-hours error contract" do
    get SNAPSHOTS_PATH

    assert_response :bad_request
    assert response.content_type.include?("application/json")
    assert_equal INVALID_HOURS_RESPONSE, JSON.parse(response.body)
  end

  test "GET snapshots with unsupported hours returns the invalid-hours error contract" do
    get "#{SNAPSHOTS_PATH}?hours=12"

    assert_response :bad_request
    assert response.content_type.include?("application/json")
    assert_equal INVALID_HOURS_RESPONSE, JSON.parse(response.body)
  end

  private

  def create_snapshot(overrides = {})
    PoolSnapshot.create!(
      {
        network_id: NETWORK_ID,
        pool_address: CANONICAL_POOL_ADDRESS,
        captured_at: Time.zone.parse("2026-04-22 12:00:00 UTC"),
        liquidity_usd: BigDecimal("123.45"),
        volume_24h_usd: nil,
        transactions_24h: nil
      }.merge(overrides)
    )
  end
end
