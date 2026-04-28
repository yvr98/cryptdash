require "digest"
require "securerandom"

class AuthSession < ApplicationRecord
  SESSION_TTL = 30.days

  belongs_to :user

  attr_accessor :raw_token

  validates :token_digest, presence: true, uniqueness: true
  validates :expires_at, presence: true

  scope :active, -> { where("expires_at > ?", Time.current) }

  def self.create_for_user!(user, expires_at: SESSION_TTL.from_now)
    token = SecureRandom.urlsafe_base64(32)
    create!(
      user: user,
      raw_token: token,
      token_digest: digest(token),
      expires_at: expires_at
    )
  end

  def self.authenticate(token)
    raw_token = token.to_s.strip
    return nil if raw_token.empty?

    active.includes(:user).find_by(token_digest: digest(raw_token))&.user
  end

  def self.revoke(token)
    raw_token = token.to_s.strip
    return if raw_token.empty?

    find_by(token_digest: digest(raw_token))&.destroy
  end

  def self.digest(token)
    Digest::SHA256.hexdigest(token)
  end
end
