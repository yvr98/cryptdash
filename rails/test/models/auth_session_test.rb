require "test_helper"

class AuthSessionTest < ActiveSupport::TestCase
  setup do
    AuthSession.delete_all
    User.delete_all
  end

  test "stores a token digest and authenticates with the raw token" do
    user = User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    session = AuthSession.create_for_user!(user)

    assert session.raw_token.present?
    assert_not_equal session.raw_token, session.token_digest
    assert_equal user, AuthSession.authenticate(session.raw_token)
  end

  test "expired sessions do not authenticate" do
    user = User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )
    session = AuthSession.create_for_user!(user, expires_at: 1.minute.ago)

    assert_nil AuthSession.authenticate(session.raw_token)
  end
end
