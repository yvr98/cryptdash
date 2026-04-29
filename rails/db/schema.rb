# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_04_29_120000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "alert_events", force: :cascade do |t|
    t.string "coin_id", null: false
    t.datetime "created_at", null: false
    t.string "direction", null: false
    t.string "name", null: false
    t.bigint "price_alert_rule_id"
    t.string "symbol", null: false
    t.decimal "target_price_usd", precision: 20, scale: 8, null: false
    t.datetime "triggered_at", null: false
    t.decimal "triggered_price_usd", precision: 20, scale: 8, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["coin_id", "triggered_at"], name: "index_alert_events_on_coin_id_and_triggered_at"
    t.index ["price_alert_rule_id"], name: "index_alert_events_on_price_alert_rule_id"
    t.index ["user_id", "triggered_at"], name: "index_alert_events_on_user_id_and_triggered_at"
    t.index ["user_id"], name: "index_alert_events_on_user_id"
  end

  create_table "auth_sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "token_digest", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["expires_at"], name: "index_auth_sessions_on_expires_at"
    t.index ["token_digest"], name: "index_auth_sessions_on_token_digest", unique: true
    t.index ["user_id"], name: "index_auth_sessions_on_user_id"
  end

  create_table "pool_snapshots", force: :cascade do |t|
    t.datetime "captured_at", null: false
    t.datetime "created_at", null: false
    t.decimal "liquidity_usd", precision: 20, scale: 8
    t.string "network_id", null: false
    t.string "pool_address", null: false
    t.bigint "transactions_24h"
    t.datetime "updated_at", null: false
    t.decimal "volume_24h_usd", precision: 20, scale: 8
    t.index ["network_id", "pool_address", "captured_at"], name: "index_pool_snapshots_on_identity_and_captured_at", unique: true
  end

  create_table "price_alert_rules", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.string "coin_id", null: false
    t.datetime "created_at", null: false
    t.string "direction", null: false
    t.datetime "last_checked_at"
    t.datetime "last_triggered_at"
    t.string "name", null: false
    t.string "symbol", null: false
    t.decimal "target_price_usd", precision: 20, scale: 8, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["coin_id", "active"], name: "index_price_alert_rules_on_coin_id_and_active"
    t.index ["user_id", "active"], name: "index_price_alert_rules_on_user_id_and_active"
    t.index ["user_id", "coin_id", "direction", "target_price_usd"], name: "index_price_alert_rules_on_unique_rule", unique: true
    t.index ["user_id"], name: "index_price_alert_rules_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "password_digest", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  create_table "watchlist_items", force: :cascade do |t|
    t.datetime "added_at", null: false
    t.string "coin_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.string "symbol", null: false
    t.string "thumb_url"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id", "coin_id"], name: "index_watchlist_items_on_user_id_and_coin_id", unique: true
    t.index ["user_id"], name: "index_watchlist_items_on_user_id"
  end

  add_foreign_key "alert_events", "price_alert_rules", on_delete: :nullify
  add_foreign_key "alert_events", "users", on_delete: :cascade
  add_foreign_key "auth_sessions", "users", on_delete: :cascade
  add_foreign_key "price_alert_rules", "users", on_delete: :cascade
  add_foreign_key "watchlist_items", "users", on_delete: :cascade
end
