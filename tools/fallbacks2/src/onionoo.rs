use reqwest::Error;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct OnionooResponse {
    relays: Vec<OnionooRelay>,
}

#[derive(Deserialize, Debug)]
pub struct OnionooRelay {
    pub nickname: String,
    pub fingerprint: String,
}

/// Search onionoo and return a vector of fingerprint strings corresponding to
/// the stablest relays
pub async fn get_relay_fprs_from_onionoo() -> Result<Vec<String>, Error> {
    // Query URL found in the old fallbackdir scripts
    let request_url = format!("https://onionoo.torproject.org/details?fields=fingerprint%2Cnickname%2Ccontact%2Clast_changed_address_or_port%2Cconsensus_weight%2Cadvertised_bandwidth%2Cor_addresses%2Cdir_address%2Crecommended_version%2Cflags%2Ceffective_family%2Cplatform&type=relay&first_seen_days=90-&last_seen_days=-0&flag=V2Dir&order=-consensus_weight%2Cfirst_seen");

    let response = reqwest::get(&request_url).await?;
    let response: OnionooResponse = response.json().await?;

    // Put all the fingerprints into a vector and return it
    Ok(response
        .relays
        .iter()
        .map(|x| {
            let mut s = String::from("$");
            s.push_str(&x.fingerprint.to_uppercase());
            return s;
        })
        .collect::<Vec<String>>())
}
