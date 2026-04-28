class Api::V1::UsersController < ApplicationController
  skip_before_action :verify_authenticity_token

  def create
    user = User.new(user_params)

    if user.save
      session = AuthSession.create_for_user!(user)

      render json: {
        session_token: session.raw_token,
        session: session_payload(user)
      }, status: :created
    else
      render json: { errors: user.errors.to_hash(true) }, status: :unprocessable_entity
    end
  end

  private

  def user_params
    params.permit(:email, :password, :password_confirmation)
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
