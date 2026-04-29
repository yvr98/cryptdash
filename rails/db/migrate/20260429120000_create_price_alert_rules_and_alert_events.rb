class CreatePriceAlertRulesAndAlertEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :price_alert_rules do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :coin_id, null: false
      t.string :name, null: false
      t.string :symbol, null: false
      t.decimal :target_price_usd, precision: 20, scale: 8, null: false
      t.string :direction, null: false
      t.boolean :active, null: false, default: true
      t.datetime :last_checked_at
      t.datetime :last_triggered_at

      t.timestamps
    end

    add_index :price_alert_rules,
      [:user_id, :coin_id, :direction, :target_price_usd],
      unique: true,
      name: "index_price_alert_rules_on_unique_rule"
    add_index :price_alert_rules, [:user_id, :active]
    add_index :price_alert_rules, [:coin_id, :active]

    create_table :alert_events do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :price_alert_rule, null: true, foreign_key: { on_delete: :nullify }
      t.string :coin_id, null: false
      t.string :name, null: false
      t.string :symbol, null: false
      t.decimal :target_price_usd, precision: 20, scale: 8, null: false
      t.decimal :triggered_price_usd, precision: 20, scale: 8, null: false
      t.string :direction, null: false
      t.datetime :triggered_at, null: false

      t.timestamps
    end

    add_index :alert_events, [:user_id, :triggered_at]
    add_index :alert_events, [:coin_id, :triggered_at]
  end
end
