require "test_helper"

class Api::V1::PriceAlertRulesTest < ActionDispatch::IntegrationTest
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

  test "GET /api/v1/price_alert_rules requires authentication" do
    get "/api/v1/price_alert_rules"

    assert_response :unauthorized
  end

  test "GET /api/v1/price_alert_rules returns authenticated user rules" do
    @user.price_alert_rules.create!(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "above"
    )

    get "/api/v1/price_alert_rules", headers: auth_headers

    assert_response :ok

    json = JSON.parse(response.body)
    assert_equal 1, json["rules"].length
    assert_equal "ethereum", json.dig("rules", 0, "coin_id")
    assert_equal "3000.0", json.dig("rules", 0, "target_price_usd")
    assert_equal "above", json.dig("rules", 0, "direction")
    assert_equal true, json.dig("rules", 0, "active")
  end

  test "POST /api/v1/price_alert_rules creates a rule" do
    post "/api/v1/price_alert_rules",
      params: {
        coin_id: "ethereum",
        name: "Ethereum",
        symbol: "ETH",
        target_price_usd: "3000.00",
        direction: "above"
      },
      headers: auth_headers

    assert_response :created

    json = JSON.parse(response.body)
    assert_equal "ethereum", json.dig("rule", "coin_id")
    assert_equal "eth", json.dig("rule", "symbol")
    assert_equal "3000.0", json.dig("rule", "target_price_usd")
  end

  test "POST /api/v1/price_alert_rules returns conflict for duplicate rule" do
    @user.price_alert_rules.create!(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "above"
    )

    assert_no_difference -> { @user.price_alert_rules.count } do
      post "/api/v1/price_alert_rules",
        params: {
          coin_id: "ethereum",
          name: "Ethereum",
          symbol: "eth",
          target_price_usd: "3000.00",
          direction: "above"
        },
        headers: auth_headers
    end

    assert_response :conflict
    assert_equal "alert already exists", JSON.parse(response.body)["error"]
  end

  test "POST /api/v1/price_alert_rules validates invalid target price" do
    post "/api/v1/price_alert_rules",
      params: {
        coin_id: "ethereum",
        name: "Ethereum",
        symbol: "eth",
        target_price_usd: "0",
        direction: "above"
      },
      headers: auth_headers

    assert_response :unprocessable_entity
    assert JSON.parse(response.body).dig("errors", "target_price_usd").present?
  end

  test "DELETE /api/v1/price_alert_rules/:id removes a user-owned rule" do
    rule = @user.price_alert_rules.create!(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "above"
    )

    delete "/api/v1/price_alert_rules/#{rule.id}", headers: auth_headers

    assert_response :ok
    assert_equal 0, @user.price_alert_rules.count
  end

  private

  def auth_headers
    {
      "Authorization" => "Bearer #{@session.raw_token}"
    }
  end
end
