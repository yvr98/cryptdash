require "test_helper"

class Api::V1::AlertEventsTest < ActionDispatch::IntegrationTest
  setup do
    AlertEvent.delete_all
    PriceAlertRule.delete_all
    AuthSession.delete_all
    User.delete_all

    @user = User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    @session = AuthSession.create_for_user!(@user)
  end

  test "GET /api/v1/alert_events requires authentication" do
    get "/api/v1/alert_events"

    assert_response :unauthorized
  end

  test "GET /api/v1/alert_events returns authenticated user history newest first" do
    older = create_event("bitcoin", triggered_at: 2.hours.ago)
    newer = create_event("ethereum", triggered_at: 1.hour.ago)

    get "/api/v1/alert_events", headers: auth_headers

    assert_response :ok

    json = JSON.parse(response.body)
    assert_equal [newer.id, older.id], json["events"].map { |event| event["id"] }
    assert_equal "3100.0", json.dig("events", 0, "triggered_price_usd")
  end

  test "GET /api/v1/alert_events can filter by coin_id" do
    create_event("bitcoin")
    create_event("ethereum")

    get "/api/v1/alert_events",
      params: { coin_id: "ethereum" },
      headers: auth_headers

    assert_response :ok

    json = JSON.parse(response.body)
    assert_equal 1, json["events"].length
    assert_equal "ethereum", json.dig("events", 0, "coin_id")
  end

  test "GET /api/v1/alert_events caps limit at 100" do
    101.times { |index| create_event("token-#{index}") }

    get "/api/v1/alert_events",
      params: { limit: 500 },
      headers: auth_headers

    assert_response :ok

    json = JSON.parse(response.body)
    assert_equal 100, json["events"].length
  end

  private

  def create_event(coin_id, triggered_at: Time.current)
    @user.alert_events.create!(
      coin_id: coin_id,
      name: coin_id.titleize,
      symbol: coin_id.first(3),
      target_price_usd: 3000,
      triggered_price_usd: 3100,
      direction: "above",
      triggered_at: triggered_at
    )
  end

  def auth_headers
    {
      "Authorization" => "Bearer #{@session.raw_token}"
    }
  end
end
