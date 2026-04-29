require "test_helper"

class PriceAlertRuleTest < ActiveSupport::TestCase
  setup do
    AlertEvent.delete_all
    PriceAlertRule.delete_all
    User.delete_all
  end

  test "normalizes identity fields and direction" do
    rule = create_user.price_alert_rules.create!(
      coin_id: "  Ethereum  ",
      name: "  Ethereum  ",
      symbol: " ETH ",
      target_price_usd: "3000.00",
      direction: " ABOVE "
    )

    assert_equal "Ethereum", rule.coin_id
    assert_equal "Ethereum", rule.name
    assert_equal "eth", rule.symbol
    assert_equal "above", rule.direction
    assert rule.active?
  end

  test "requires a positive target price" do
    rule = create_user.price_alert_rules.new(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 0,
      direction: "above"
    )

    assert_not rule.valid?
    assert_includes rule.errors[:target_price_usd], "must be greater than 0"
  end

  test "requires direction to be above or below" do
    rule = create_user.price_alert_rules.new(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "sideways"
    )

    assert_not rule.valid?
    assert_includes rule.errors[:direction], "is not included in the list"
  end

  test "prevents duplicate rule for the same user coin direction and price" do
    user = create_user
    user.price_alert_rules.create!(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "above"
    )

    duplicate = user.price_alert_rules.new(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "above"
    )

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:coin_id], "alert already exists"
  end

  test "triggered_by? evaluates above and below rules" do
    user = create_user
    above = user.price_alert_rules.create!(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "above"
    )
    below = user.price_alert_rules.create!(
      coin_id: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
      target_price_usd: 50000,
      direction: "below"
    )

    assert above.triggered_by?(3000)
    assert above.triggered_by?(3500)
    assert_not above.triggered_by?(2999)

    assert below.triggered_by?(50000)
    assert below.triggered_by?(45000)
    assert_not below.triggered_by?(50001)
  end

  private

  def create_user
    User.create!(
      email: "demo-#{SecureRandom.hex(4)}@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
  end
end
