require "test_helper"

class Api::V1::SessionTest < ActionDispatch::IntegrationTest
  setup do
    AuthSession.delete_all
    User.delete_all
  end

  test "GET /api/v1/session returns 200 with JSON content type" do
    get "/api/v1/session"
    assert_response :ok
    assert response.content_type.include?("application/json")
  end

  test "GET /api/v1/session returns auth-shaped payload" do
    get "/api/v1/session"
    json = JSON.parse(response.body)

    assert_equal false, json["authenticated"]
    assert_equal "ok", json["status"]
    assert_nil json["user"]
  end

  test "GET /api/v1/session returns capabilities object" do
    get "/api/v1/session"
    json = JSON.parse(response.body)
    capabilities = json["capabilities"]

    assert_instance_of Hash, capabilities
    assert_equal false, capabilities["google_oauth"]
    assert_equal true, capabilities["write_auth_enabled"]
  end

  test "GET /api/v1/session response contains exactly the expected keys" do
    get "/api/v1/session"
    json = JSON.parse(response.body)

    expected_keys = %w[authenticated status user capabilities].sort
    assert_equal expected_keys, json.keys.sort
  end

  test "capabilities contains exactly the expected keys" do
    get "/api/v1/session"
    json = JSON.parse(response.body)
    capabilities = json["capabilities"]

    expected_keys = %w[google_oauth write_auth_enabled].sort
    assert_equal expected_keys, capabilities.keys.sort
  end

  test "missing route under /api/v1/session returns non-200 response" do
    get "/api/v1/session/missing"
    assert_not_equal 200, response.status
  end

  test "POST /api/v1/session creates an auth session for valid credentials" do
    user = User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    post "/api/v1/session", params: {
      email: "DEMO@example.com",
      password: "password123"
    }

    assert_response :created

    json = JSON.parse(response.body)

    assert json["session_token"].present?
    assert_equal true, json.dig("session", "authenticated")
    assert_equal user.email, json.dig("session", "user", "email")
  end

  test "POST /api/v1/session rejects invalid credentials" do
    User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    post "/api/v1/session", params: {
      email: "demo@example.com",
      password: "wrong-password"
    }

    assert_response :unauthorized
  end

  test "GET /api/v1/session authenticates bearer session token" do
    user = User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    session = AuthSession.create_for_user!(user)

    get "/api/v1/session", headers: {
      "Authorization" => "Bearer #{session.raw_token}"
    }

    assert_response :ok

    json = JSON.parse(response.body)

    assert_equal true, json["authenticated"]
    assert_equal user.email, json.dig("user", "email")
  end
end
