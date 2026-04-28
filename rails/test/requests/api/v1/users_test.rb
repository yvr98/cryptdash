require "test_helper"

class Api::V1::UsersTest < ActionDispatch::IntegrationTest
  setup do
    AuthSession.delete_all
    User.delete_all
  end

  test "POST /api/v1/users creates a user and returns a session token" do
    post "/api/v1/users", params: {
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    }

    assert_response :created

    json = JSON.parse(response.body)

    assert json["session_token"].present?
    assert_equal true, json.dig("session", "authenticated")
    assert_equal "demo@example.com", json.dig("session", "user", "email")
  end

  test "POST /api/v1/users returns validation errors for invalid payload" do
    post "/api/v1/users", params: {
      email: "not-an-email",
      password: "short",
      password_confirmation: "different"
    }

    assert_response :unprocessable_entity

    json = JSON.parse(response.body)

    assert_instance_of Hash, json["errors"]
  end
end
