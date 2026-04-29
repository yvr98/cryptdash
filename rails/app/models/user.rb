class User < ApplicationRecord
  has_secure_password

  has_many :auth_sessions, dependent: :destroy
  has_many :watchlist_items, dependent: :destroy
  has_many :price_alert_rules, dependent: :destroy
  has_many :alert_events, dependent: :destroy

  before_validation :normalize_email

  validates :email,
    presence: true,
    uniqueness: { case_sensitive: false },
    format: { with: URI::MailTo::EMAIL_REGEXP }

  private

  def normalize_email
    self.email = email.to_s.strip.downcase
  end
end
