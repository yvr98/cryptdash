require "test_helper"

class Api::V1::PoolSnapshotsCaptureTest < ActionDispatch::IntegrationTest
  CAPTURE_PATH = "/api/v1/pools/ethereum/0xAbCdEf1234567890/snapshots/capture".freeze
  CAPTURE_SECRET = "test-capture-secret".freeze
  CAPTURE_HEADERS = {
    InternalSnapshotCaptureConfig::SECRET_HEADER => CAPTURE_SECRET,
    "Content-Type" => "application/json"
  }.freeze

  setup do
    @previous_secret = ENV[InternalSnapshotCaptureConfig::SECRET_ENV_KEY]
    ENV[InternalSnapshotCaptureConfig::SECRET_ENV_KEY] = CAPTURE_SECRET
    PoolSnapshot.delete_all
  end

  teardown do
    if @previous_secret.nil?
      ENV.delete(InternalSnapshotCaptureConfig::SECRET_ENV_KEY)
    else
      ENV[InternalSnapshotCaptureConfig::SECRET_ENV_KEY] = @previous_secret
    end
  end

  test "POST capture creates a snapshot and returns created outcome" do
    freeze_time do
      post CAPTURE_PATH,
        params: {
          liquidity_usd: "12345.67",
          volume_24h_usd: "456.78",
          transactions_24h: 99,
          network_id: "ignored-network",
          pool_address: "ignored-address"
        }.to_json,
        headers: CAPTURE_HEADERS

      assert_response :created

      json = JSON.parse(response.body)
      assert_equal "created", json["status"]
      assert_equal Time.current.iso8601, json["captured_at"]

      snapshot = PoolSnapshot.order(:created_at).last
      assert_not_nil snapshot
      assert_equal "ethereum", snapshot.network_id
      assert_equal "0xabcdef1234567890", snapshot.pool_address
      assert_equal BigDecimal("12345.67"), snapshot.liquidity_usd
      assert_equal BigDecimal("456.78"), snapshot.volume_24h_usd
      assert_equal 99, snapshot.transactions_24h
      assert_equal Time.current, snapshot.captured_at
    end
  end

  test "POST capture returns throttled skip when the latest snapshot is within one hour" do
    freeze_time do
      PoolSnapshot.create!(
        network_id: "ethereum",
        pool_address: "0xabcdef1234567890",
        captured_at: 30.minutes.ago,
        liquidity_usd: BigDecimal("1000")
      )

      post CAPTURE_PATH,
        params: { liquidity_usd: "2000" }.to_json,
        headers: CAPTURE_HEADERS

      assert_response :ok

      json = JSON.parse(response.body)
      assert_equal({ "status" => "skipped", "reason" => "throttled" }, json)
      assert_equal 1, PoolSnapshot.count
    end
  end

  test "POST capture returns no_metrics skip when all accepted metrics are absent" do
    post CAPTURE_PATH,
      params: {}.to_json,
      headers: CAPTURE_HEADERS

    assert_response :ok

    json = JSON.parse(response.body)
    assert_equal({ "status" => "skipped", "reason" => "no_metrics" }, json)
    assert_equal 0, PoolSnapshot.count
  end

  test "POST capture returns stable unauthorized response for missing secret" do
    post CAPTURE_PATH,
      params: { liquidity_usd: "123" }.to_json,
      headers: { "Content-Type" => "application/json" }

    assert_response :unauthorized
    assert_equal({ "error" => "unauthorized" }, JSON.parse(response.body))
    assert_equal 0, PoolSnapshot.count
  end

  test "POST capture overlap for same pool creates at most one row" do
    freeze_time do
      responses = []
      mutex = Mutex.new

      threads = 2.times.map do
        Thread.new do
          session = open_session
          session.post CAPTURE_PATH,
            params: { liquidity_usd: "5000", transactions_24h: 12 }.to_json,
            headers: CAPTURE_HEADERS

          parsed = JSON.parse(session.response.body)

          mutex.synchronize do
            responses << { status: session.response.status, body: parsed }
          end
        end
      end

      threads.each(&:join)

      assert_equal 1, PoolSnapshot.count
      assert_equal 1, responses.count { |entry| entry[:status] == 201 && entry[:body]["status"] == "created" }
      assert_equal 1, responses.count { |entry| entry[:status] == 200 && entry[:body] == { "status" => "skipped", "reason" => "throttled" } }
    end
  end
end
