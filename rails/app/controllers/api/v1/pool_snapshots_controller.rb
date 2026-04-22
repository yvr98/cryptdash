class Api::V1::PoolSnapshotsController < ApplicationController
  skip_before_action :verify_authenticity_token

  INVALID_HOURS_RESPONSE = {
    error: "hours must be exactly 24"
  }.freeze

  WINDOW_HOURS = 24

  def index
    return render_invalid_hours unless params[:hours] == WINDOW_HOURS.to_s

    snapshots = selected_snapshots

    render json: {
      window_hours: WINDOW_HOURS,
      row_count: snapshots.length,
      rows: serialize_rows(snapshots)
    }, status: :ok
  end

  private

  def selected_snapshots
    now = Time.current
    window_start = now - WINDOW_HOURS.hours

    PoolSnapshot
      .where(network_id: normalized_network_id, pool_address: normalized_pool_address)
      .where("captured_at > ? AND captured_at <= ?", window_start, now)
      .order(captured_at: :desc)
      .limit(WINDOW_HOURS)
      .to_a
      .reverse
  end

  def serialize_rows(snapshots)
    snapshots.map do |snapshot|
      {
        captured_at: snapshot.captured_at.iso8601,
        liquidity_usd: decimal_as_json_string(snapshot.liquidity_usd),
        volume_24h_usd: decimal_as_json_string(snapshot.volume_24h_usd),
        transactions_24h: snapshot.transactions_24h
      }
    end
  end

  def decimal_as_json_string(value)
    value&.to_s("F")
  end

  def normalized_network_id
    params[:network_id].to_s.strip
  end

  def normalized_pool_address
    params[:pool_address].to_s.strip.downcase
  end

  def render_invalid_hours
    render json: INVALID_HOURS_RESPONSE, status: :bad_request
  end
end
