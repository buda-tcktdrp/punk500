// api/album-meta.js
export default async function handler(req, res) {
  try {
    const { artist = "", album = "" } = req.query;
    if (!artist || !album) {
      return res.status(400).json({ error: "artist and album are required" });
    }

    // 1) Keresés a MusicBrainz-en (release-group szint)
    // Docs: https://musicbrainz.org/doc/Development/XML_Web_Service/Version_2
    const q = encodeURIComponent(`releasegroup:"${album}" AND artist:"${artist}"`);
    const mbUrl = `https://musicbrainz.org/ws/2/release-group?query=${q}&fmt=json&limit=1`;
    const mbResp = await fetch(mbUrl, {
      headers: { "User-Agent": "ticketdrop-punk500/1.0 (contact: you@example.com)" },
    });
    if (!mbResp.ok) throw new Error(`MusicBrainz error ${mbResp.status}`);
    const mb = await mbResp.json();

    const rg = (mb["release-groups"] || [])[0];
    let coverUrl = null;

    if (rg && rg.id) {
      // 2) Cover Art Archive – először próbáld a nagy front képet
      // pl. https://coverartarchive.org/release-group/<MBID>/front-500
      const sizes = ["1200", "1000", "800", "500", "250"];
      for (const s of sizes) {
        const testUrl = `https://coverartarchive.org/release-group/${rg.id}/front-${s}`;
        const head = await fetch(testUrl, { method: "HEAD" });
        if (head.ok) { coverUrl = testUrl; break; }
      }
      // ha nincs méretezett, próbáld a default 'front'
      if (!coverUrl) {
        const defUrl = `https://coverartarchive.org/release-group/${rg.id}/front`;
        const head = await fetch(defUrl, { method: "HEAD" });
        if (head.ok) coverUrl = defUrl;
      }
    }

    const query = encodeURIComponent(`${artist} ${album}`);
    const spotifySearchUrl = `https://open.spotify.com/search/${query}`;
    const ytMusicSearchUrl = `https://music.youtube.com/search?q=${query}`;
    const discogsSearchUrl = `https://www.discogs.com/search/?q=${query}&type=all`;

    return res.status(200).json({
      artist, album, coverUrl,
      links: { spotifySearchUrl, ytMusicSearchUrl, discogsSearchUrl },
      source: "musicbrainz+coverartarchive"
    });
  } catch (e) {
    return res.status(200).json({
      error: String(e),
      coverUrl: null
    });
  }
}
