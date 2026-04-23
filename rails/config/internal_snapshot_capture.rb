module InternalSnapshotCaptureConfig
  SECRET_ENV_KEY = "INTERNAL_SNAPSHOT_CAPTURE_SECRET".freeze
  SECRET_HEADER = "X-CryptDash-Internal-Capture-Secret".freeze
  PATH_TEMPLATE = "/api/v1/pools/:network_id/:pool_address/snapshots/capture".freeze

  module_function

  def secret
    ENV.fetch(SECRET_ENV_KEY, "").strip.presence
  end

  def secret_configured?
    !secret.nil?
  end

  def require_secret!
    return secret if secret

    raise(
      "#{SECRET_ENV_KEY} is required in production. " \
      "Set it to the dedicated shared secret for the internal snapshot capture seam."
    )
  end

  def validate_environment!(environment: Rails.env)
    return if environment != "production"

    require_secret!
  end
end
