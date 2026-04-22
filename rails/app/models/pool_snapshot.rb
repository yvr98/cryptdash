class PoolSnapshot < ApplicationRecord
  METRIC_ATTRIBUTES = %i[liquidity_usd volume_24h_usd transactions_24h].freeze

  before_validation :normalize_identity_fields

  validates :network_id, presence: true
  validates :pool_address, presence: true
  validates :captured_at, presence: true
  validates :transactions_24h,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 },
    allow_nil: true
  validates :pool_address,
    uniqueness: {
      scope: [:network_id, :captured_at],
      case_sensitive: false
    }

  validate :requires_at_least_one_metric

  def self.qualifies_for_persistence?(attributes)
    metrics_present?(attributes.to_h.symbolize_keys)
  end

  def qualifies_for_persistence?
    self.class.metrics_present?(attributes.symbolize_keys)
  end

  def self.metrics_present?(attributes)
    METRIC_ATTRIBUTES.any? { |attribute| !attributes[attribute].nil? }
  end

  private

  def normalize_identity_fields
    self.network_id = network_id.to_s.strip
    self.pool_address = pool_address.to_s.strip.downcase
  end

  def requires_at_least_one_metric
    return if qualifies_for_persistence?

    errors.add(:base, "at least one metric must be present")
  end
end
