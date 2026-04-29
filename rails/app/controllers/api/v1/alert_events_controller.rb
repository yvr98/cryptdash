class Api::V1::AlertEventsController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :require_authenticated_user

  DEFAULT_LIMIT = 50
  MAX_LIMIT = 100

  def index
    events = current_user.alert_events.order(triggered_at: :desc)
    events = events.where(coin_id: normalized_coin_id) if normalized_coin_id.present?

    render json: {
      events: events.limit(limit).map { |event| serialize_event(event) }
    }, status: :ok
  end

  private

  def normalized_coin_id
    params[:coin_id].to_s.strip
  end

  def limit
    requested = params[:limit].to_i
    return DEFAULT_LIMIT if requested <= 0

    [requested, MAX_LIMIT].min
  end

  def serialize_event(event)
    {
      id: event.id,
      price_alert_rule_id: event.price_alert_rule_id,
      coin_id: event.coin_id,
      name: event.name,
      symbol: event.symbol,
      target_price_usd: decimal_to_s(event.target_price_usd),
      triggered_price_usd: decimal_to_s(event.triggered_price_usd),
      direction: event.direction,
      triggered_at: event.triggered_at.iso8601,
      created_at: event.created_at.iso8601
    }
  end

  def decimal_to_s(value)
    value.to_d.to_s("F")
  end
end
