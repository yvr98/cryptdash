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

ActiveRecord::Schema[8.1].define(version: 2026_04_22_120000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

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
end
