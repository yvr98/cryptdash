class Api::V1::WatchlistItemsController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :require_authenticated_user

  def index
    render json: {
      items: current_user.watchlist_items.order(added_at: :desc).map { |item| serialize_item(item) }
    }, status: :ok
  end

  def create
    item = current_user.watchlist_items.find_or_initialize_by(coin_id: normalized_coin_id)
    was_persisted = item.persisted?

    item.assign_attributes(watchlist_item_params.except(:coin_id)) unless was_persisted

    if item.save
      render json: { item: serialize_item(item) }, status: was_persisted ? :ok : :created
    else
      render json: { errors: item.errors.to_hash(true) }, status: :unprocessable_entity
    end
  end

  def destroy
    item = current_user.watchlist_items.find_by(coin_id: normalized_coin_id)

    unless item
      return render json: { error: "watchlist item not found" }, status: :not_found
    end

    item.destroy
    render json: { status: "ok" }, status: :ok
  end

  private

  def watchlist_item_params
    params.permit(:coin_id, :name, :symbol, :thumb_url)
  end

  def normalized_coin_id
    params[:coin_id].to_s.strip
  end

  def serialize_item(item)
    {
      coin_id: item.coin_id,
      name: item.name,
      symbol: item.symbol,
      thumb_url: item.thumb_url,
      added_at: item.added_at.iso8601
    }
  end
end
