require "test_helper"

class WatchlistItemTest < ActiveSupport::TestCase
  setup do
    WatchlistItem.delete_all
    User.delete_all
  end

  test "normalizes identity fields and defaults added_at" do
    user = create_user
    item = user.watchlist_items.create!(
      coin_id: "  bitcoin  ",
      name: "  Bitcoin  ",
      symbol: " BTC ",
      thumb_url: "  https://example.com/btc.png  "
    )

    assert_equal "bitcoin", item.coin_id
    assert_equal "Bitcoin", item.name
    assert_equal "btc", item.symbol
    assert_equal "https://example.com/btc.png", item.thumb_url
    assert item.added_at.present?
  end

  test "requires unique coin per user" do
    user = create_user
    user.watchlist_items.create!(coin_id: "bitcoin", name: "Bitcoin", symbol: "btc")

    duplicate = user.watchlist_items.new(coin_id: "bitcoin", name: "Bitcoin", symbol: "btc")

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:coin_id], "has already been taken"
  end

  private

  def create_user
    User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
  end
end
