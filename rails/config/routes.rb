Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check


  # Pool snapshot seams for issue #9.
  namespace :api do
    namespace :v1 do
      resource :session, only: [:show]

      get  "pools/:network_id/:pool_address/snapshots",
           to: "pool_snapshots#index",
           as: :pool_snapshots
      post "pools/:network_id/:pool_address/snapshots/capture",
           to: "pool_snapshots_capture#create",
           as: :pool_snapshot_capture
    end
  end
  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  # root "posts#index"
end
