class CreatePoolSnapshots < ActiveRecord::Migration[8.1]
  def change
    create_table :pool_snapshots do |t|
      t.string :network_id, null: false
      t.string :pool_address, null: false
      t.datetime :captured_at, null: false
      t.decimal :liquidity_usd, precision: 20, scale: 8
      t.decimal :volume_24h_usd, precision: 20, scale: 8
      t.bigint :transactions_24h

      t.timestamps
    end

    add_index :pool_snapshots,
      [:network_id, :pool_address, :captured_at],
      unique: true,
      name: "index_pool_snapshots_on_identity_and_captured_at"
  end
end
