require "test_helper"

class UserTest < ActiveSupport::TestCase
  setup do
    WatchlistItem.delete_all
    AuthSession.delete_all
    User.delete_all
  end

  test "normalizes email before validation" do
    user = User.create!(
      email: "  DEMO@Example.COM  ",
      password: "password123",
      password_confirmation: "password123"
    )

    assert_equal "demo@example.com", user.email
  end

  test "requires unique email" do
    User.create!(
      email: "demo@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    duplicate = User.new(
      email: "DEMO@example.com",
      password: "password123",
      password_confirmation: "password123"
    )

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:email], "has already been taken"
  end
end
