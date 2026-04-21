class Api::V1::SessionsController < ApplicationController
  skip_before_action :verify_authenticity_token

  def show
    render json: {
      authenticated: false,
      status: "ok",
      user: nil,
      capabilities: {
        google_oauth: false,
        write_auth_enabled: false
      }
    }
  end
end
