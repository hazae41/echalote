use anyhow::Result;
use arti_client::{self, TorClientConfig};
use rand::seq::SliceRandom;
use base64ct::Encoding;
use serde_json::json;
use std::fs::File;
use std::io::{BufWriter, Write};
use tokio_crate as tokio;
use tor_dirmgr::Timeliness;
use tor_netdoc::doc::netstatus::RelayFlags;

mod onionoo;

#[tokio::main]
async fn main() -> Result<()>  {
  let config = TorClientConfig::default();

  println!("[+] Fetching onionoo relays...");
  let onionoo_relays_fprs = onionoo::get_relay_fprs_from_onionoo().await?;

  println!("[+] Bootstrapping to the Tor network...");
  let arti_client = arti_client::TorClient::create_bootstrapped(config).await?;
  let netdir = arti_client.dirmgr().netdir(Timeliness::Strict).unwrap();

  println!("[+] Cross-referencing relays between Onionoo and Tor consensus...");



  {
    let fallbacks2: Vec<_> = netdir
      .relays()
      .filter(|r| {
          r.is_dir_cache()
              && r.rs().flags().contains(RelayFlags::FAST)
              && r.rs().flags().contains(RelayFlags::STABLE)
              && onionoo_relays_fprs.contains(&r.rsa_id().to_string().to_uppercase())
      })
      .collect();

    println!("Got {} relays. Randomly sampling 200...", relays.len());
 
    let picks = fallbacks2.choose_multiple(&mut rand::thread_rng(), 200);

    let file = File::create("fallbacks2.json")?;

    let mut writer = BufWriter::new(&file);

    let json = json!(picks.map(|relay| {
        json!({
          "nickname": relay.rs().nickname(),
          "rsa_id": relay.rsa_id().to_string().to_uppercase().replace("$", ""),
          "ed25519_id": relay.md().ed25519_id().to_string(),
          "ntor_key": base64ct::Base64Unpadded::encode_string(&relay.md().ntor_key().to_bytes()),
          "orport_addrs": relay
          .rs()
          .orport_addrs()
          .map(|a| a.to_string())
          .collect::<Vec<String>>()
        })
    }).collect::<serde_json::Value>());

    writeln!(writer, "{}", json.to_string())?;>
  }

  Ok(())
}
