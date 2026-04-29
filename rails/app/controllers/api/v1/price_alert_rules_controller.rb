class Api::V1::PriceAlertRulesController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :require_authenticated_user

  def index
    rules = current_user.price_alert_rules.order(created_at: :desc)

    render json: {
      rules: rules.map { |rule| serialize_rule(rule) }
    }, status: :ok
  end

  def create
    rule = current_user.price_alert_rules.new(price_alert_rule_params)

    if rule.save
      render json: { rule: serialize_rule(rule) }, status: :created
    elsif duplicate_alert_error?(rule)
      render json: { error: "alert already exists" }, status: :conflict
    else
      render json: { errors: rule.errors.to_hash(true) }, status: :unprocessable_entity
    end
  end

  def destroy
    rule = current_user.price_alert_rules.find_by(id: params[:id])

    unless rule
      return render json: { error: "price alert rule not found" }, status: :not_found
    end

    rule.destroy
    render json: { status: "ok" }, status: :ok
  end

  private

  def price_alert_rule_params
    params.permit(:coin_id, :name, :symbol, :target_price_usd, :direction, :active)
  end

  def duplicate_alert_error?(rule)
    rule.errors[:coin_id].include?("alert already exists")
  end

  def serialize_rule(rule)
    {
      id: rule.id,
      coin_id: rule.coin_id,
      name: rule.name,
      symbol: rule.symbol,
      target_price_usd: decimal_to_s(rule.target_price_usd),
      direction: rule.direction,
      active: rule.active,
      last_checked_at: rule.last_checked_at&.iso8601,
      last_triggered_at: rule.last_triggered_at&.iso8601,
      created_at: rule.created_at.iso8601,
      updated_at: rule.updated_at.iso8601
    }
  end

  def decimal_to_s(value)
    value.to_d.to_s("F")
  end
end
