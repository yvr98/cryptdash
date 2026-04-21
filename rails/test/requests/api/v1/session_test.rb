require "test_helper"

class Api::V1::SessionTest < ActionDispatch::IntegrationTest
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
    assert_equal false, capabilities["write_auth_enabled"]
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
end
