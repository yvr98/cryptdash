class Api::V1::PoolSnapshotsCaptureController < ApplicationController
  skip_before_action :verify_authenticity_token

  UNAUTHORIZED_RESPONSE = {
    error: "unauthorized"
  }.freeze

  def create
    return render_unauthorized unless authorized_request?

    attributes = capture_attributes

    unless PoolSnapshot.qualifies_for_persistence?(attributes)
      return render json: { status: "skipped", reason: "no_metrics" }, status: :ok
    end

    outcome = persist_snapshot(attributes)

    if outcome[:status] == "created"
      render json: outcome, status: :created
    else
      render json: outcome, status: :ok
    end
  end

  private

  def authorized_request?
    expected_secret = InternalSnapshotCaptureConfig.secret.to_s
    provided_secret = request.headers[InternalSnapshotCaptureConfig::SECRET_HEADER].to_s

    return false if expected_secret.empty? || provided_secret.empty?

    ActiveSupport::SecurityUtils.secure_compare(provided_secret, expected_secret)
  end

  def render_unauthorized
    render json: UNAUTHORIZED_RESPONSE, status: :unauthorized
  end

  def capture_attributes
    permitted = params.permit(:liquidity_usd, :volume_24h_usd, :transactions_24h)

    {
      network_id: params[:network_id],
      pool_address: params[:pool_address],
      liquidity_usd: permitted[:liquidity_usd],
      volume_24h_usd: permitted[:volume_24h_usd],
      transactions_24h: permitted[:transactions_24h],
      captured_at: Time.current
    }
  end

  def persist_snapshot(attributes)
    PoolSnapshot.transaction do
      acquire_pool_lock(attributes[:network_id], attributes[:pool_address])

      latest_snapshot = PoolSnapshot
        .where(network_id: attributes[:network_id], pool_address: attributes[:pool_address].to_s.strip.downcase)
        .order(captured_at: :desc)
        .first

      if throttled?(latest_snapshot, attributes[:captured_at])
        { status: "skipped", reason: "throttled" }
      else
        snapshot = PoolSnapshot.create!(attributes)

        {
          status: "created",
          captured_at: snapshot.captured_at.iso8601
        }
      end
    end
  end

  def throttled?(latest_snapshot, captured_at)
    return false if latest_snapshot.nil?

    latest_snapshot.captured_at > (captured_at - 1.hour)
  end

  def acquire_pool_lock(network_id, pool_address)
    normalized_network_id = network_id.to_s.strip
    normalized_pool_address = pool_address.to_s.strip.downcase

    sql = <<~SQL.squish
      SELECT pg_advisory_xact_lock(
        hashtext($1),
        hashtext($2)
      )
    SQL

    binds = [
      ActiveRecord::Relation::QueryAttribute.new(
        "network_id",
        normalized_network_id,
        ActiveRecord::Type::String.new
      ),
      ActiveRecord::Relation::QueryAttribute.new(
        "pool_address",
        normalized_pool_address,
        ActiveRecord::Type::String.new
      )
    ]

    ActiveRecord::Base.connection.exec_query(sql, "PoolSnapshot capture lock", binds)
  end
end
