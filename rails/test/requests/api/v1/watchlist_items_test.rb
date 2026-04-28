require "test_helper"

class Api::V1::WatchlistItemsTest < ActionDispatch::IntegrationTest
  setup do
    WatchlistItem.delete_all
    AuthSession.delete_all
    User.delete_all

    @user = User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    @session = AuthSession.create_for_user!(@user)
  end

  test "GET /api/v1/watchlist_items requires authentication" do
    get "/api/v1/watchlist_items"

    assert_response :unauthorized
  end

  test "GET /api/v1/watchlist_items returns authenticated user watchlist" do
    @user.watchlist_items.create!(coin_id: "bitcoin", name: "Bitcoin", symbol: "btc")

    get "/api/v1/watchlist_items", headers: auth_headers

    assert_response :ok

    json = JSON.parse(response.body)

    assert_equal 1, json["items"].length
    assert_equal "bitcoin", json.dig("items", 0, "coin_id")
  end

  test "POST /api/v1/watchlist_items creates a watchlist item" do
    post "/api/v1/watchlist_items",
      params: {
        coin_id: "ethereum",
        name: "Ethereum",
        symbol: "eth",
        thumb_url: "https://example.com/eth.png"
      },
      headers: auth_headers

    assert_response :created

    json = JSON.parse(response.body)

    assert_equal "ethereum", json.dig("item", "coin_id")
    assert_equal "eth", json.dig("item", "symbol")
  end

  test "POST /api/v1/watchlist_items is idempotent for duplicate coins" do
    @user.watchlist_items.create!(coin_id: "bitcoin", name: "Bitcoin", symbol: "btc")

    assert_no_difference -> { @user.watchlist_items.count } do
      post "/api/v1/watchlist_items",
        params: {
          coin_id: "bitcoin",
          name: "Bitcoin",
          symbol: "btc"
        },
        headers: auth_headers
    end

    assert_response :ok
  end

  test "DELETE /api/v1/watchlist_items/:coin_id removes a watchlist item" do
    @user.watchlist_items.create!(coin_id: "bitcoin", name: "Bitcoin", symbol: "btc")

    delete "/api/v1/watchlist_items/bitcoin", headers: auth_headers

    assert_response :ok
    assert_equal 0, @user.watchlist_items.count
  end

  private

  def auth_headers
    {
      "Authorization" => "Bearer #{@session.raw_token}"
    }
  end
end
