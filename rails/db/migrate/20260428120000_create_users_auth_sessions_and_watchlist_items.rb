class CreateUsersAuthSessionsAndWatchlistItems < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false

      t.timestamps
    end

    add_index :users, :email, unique: true

    create_table :auth_sessions do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :token_digest, null: false
      t.datetime :expires_at, null: false

      t.timestamps
    end

    add_index :auth_sessions, :token_digest, unique: true
    add_index :auth_sessions, :expires_at

    create_table :watchlist_items do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :coin_id, null: false
      t.string :name, null: false
      t.string :symbol, null: false
      t.string :thumb_url
      t.datetime :added_at, null: false

      t.timestamps
    end

    add_index :watchlist_items, [:user_id, :coin_id], unique: true
  end
end
