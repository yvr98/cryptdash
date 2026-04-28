class Api::V1::SessionsController < ApplicationController
  skip_before_action :verify_authenticity_token

  def show
    return render_session(current_user) if current_user

    render json: {
      authenticated: false,
      status: "ok",
      user: nil,
      capabilities: {
        google_oauth: false,
        write_auth_enabled: true
      }
    }
  end

  def create
    user = User.find_by(email: normalized_email)

    unless user&.authenticate(params[:password].to_s)
      return render json: { error: "invalid email or password" }, status: :unauthorized
    end

    session = AuthSession.create_for_user!(user)

    render json: {
      session_token: session.raw_token,
      session: session_payload(user)
    }, status: :created
  end

  def destroy
    AuthSession.revoke(current_session_token)
    render json: { status: "ok" }, status: :ok
  end

  private

  def normalized_email
    params[:email].to_s.strip.downcase
  end

  def render_session(user)
    render json: session_payload(user), status: :ok
  end

  def session_payload(user)
    {
      authenticated: true,
      status: "ok",
      user: {
        email: user.email
      },
      capabilities: {
        google_oauth: false,
        write_auth_enabled: true
      }
    }
  end
end
