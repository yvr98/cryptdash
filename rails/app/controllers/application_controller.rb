class ApplicationController < ActionController::Base
  # Only allow modern browsers supporting webp images, web push, badges, import maps, CSS nesting, and CSS :has.
  allow_browser versions: :modern

  CRYPTDASH_SESSION_COOKIE_NAME = "_cryptdash_rails_session".freeze

  private

  def current_user
    @current_user ||= AuthSession.authenticate(current_session_token)
  end

  def require_authenticated_user
    return if current_user

    render json: { error: "unauthenticated" }, status: :unauthorized
  end

  def current_session_token
    bearer_session_token.presence || cookies[CRYPTDASH_SESSION_COOKIE_NAME].presence
  end

  def bearer_session_token
    authorization = request.authorization.to_s
    return nil unless authorization.start_with?("Bearer ")

    authorization.delete_prefix("Bearer ").strip
  end
end
