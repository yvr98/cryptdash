require "test_helper"

class InternalSnapshotCaptureConfigTest < ActiveSupport::TestCase
  setup do
    @original_secret = ENV[InternalSnapshotCaptureConfig::SECRET_ENV_KEY]
  end

  teardown do
    if @original_secret.nil?
      ENV.delete(InternalSnapshotCaptureConfig::SECRET_ENV_KEY)
    else
      ENV[InternalSnapshotCaptureConfig::SECRET_ENV_KEY] = @original_secret
    end
  end

  test "exposes the dedicated internal capture header contract" do
    assert_equal "X-TokenScope-Internal-Capture-Secret", InternalSnapshotCaptureConfig::SECRET_HEADER
    assert_equal "/api/v1/pools/:network_id/:pool_address/snapshots/capture", InternalSnapshotCaptureConfig::PATH_TEMPLATE
  end

  test "returns nil secret when missing outside production" do
    ENV.delete(InternalSnapshotCaptureConfig::SECRET_ENV_KEY)

    assert_nil InternalSnapshotCaptureConfig.secret
    assert_equal false, InternalSnapshotCaptureConfig.secret_configured?
    assert_nil InternalSnapshotCaptureConfig.validate_environment!(environment: "development")
    assert_nil InternalSnapshotCaptureConfig.validate_environment!(environment: "test")
  end

  test "trims configured secret" do
    ENV[InternalSnapshotCaptureConfig::SECRET_ENV_KEY] = "  internal-secret  "

    assert_equal "internal-secret", InternalSnapshotCaptureConfig.secret
    assert_equal true, InternalSnapshotCaptureConfig.secret_configured?
  end

  test "raises in production when secret is missing" do
    ENV.delete(InternalSnapshotCaptureConfig::SECRET_ENV_KEY)

    error = assert_raises(RuntimeError) do
      InternalSnapshotCaptureConfig.validate_environment!(environment: "production")
    end

    assert_includes error.message, "INTERNAL_SNAPSHOT_CAPTURE_SECRET is required in production"
  end

  test "accepts configured secret in production" do
    ENV[InternalSnapshotCaptureConfig::SECRET_ENV_KEY] = "shared-secret"

    assert_equal "shared-secret", InternalSnapshotCaptureConfig.validate_environment!(environment: "production")
  end
end
