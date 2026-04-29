require "test_helper"

class AlertEventTest < ActiveSupport::TestCase
  setup do
    AlertEvent.delete_all
    PriceAlertRule.delete_all
    User.delete_all
  end

  test "normalizes identity fields and defaults triggered_at" do
    user = create_user
    event = user.alert_events.create!(
      coin_id: "  Ethereum  ",
      name: "  Ethereum  ",
      symbol: " ETH ",
      target_price_usd: 3000,
      triggered_price_usd: 3100,
      direction: " ABOVE "
    )

    assert_equal "Ethereum", event.coin_id
    assert_equal "Ethereum", event.name
    assert_equal "eth", event.symbol
    assert_equal "above", event.direction
    assert event.triggered_at.present?
  end

  test "requires positive target and triggered prices" do
    event = create_user.alert_events.new(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 0,
      triggered_price_usd: 0,
      direction: "above"
    )

    assert_not event.valid?
    assert_includes event.errors[:target_price_usd], "must be greater than 0"
    assert_includes event.errors[:triggered_price_usd], "must be greater than 0"
  end

  test "can keep history after alert rule is deleted" do
    user = create_user
    rule = user.price_alert_rules.create!(
      coin_id: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      target_price_usd: 3000,
      direction: "above"
    )
    event = user.alert_events.create!(
      price_alert_rule: rule,
      coin_id: rule.coin_id,
      name: rule.name,
      symbol: rule.symbol,
      target_price_usd: rule.target_price_usd,
      triggered_price_usd: 3100,
      direction: rule.direction
    )

    rule.destroy

    assert_nil event.reload.price_alert_rule_id
    assert_equal "ethereum", event.coin_id
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
