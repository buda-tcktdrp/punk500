// api/album-meta.js
export default async function handler(req, res) {
  try {
    const { artist = "", album = "" } = req.query;
    if (!artist || !album) {
      return res.status(400).json({ error: "artist and album are required" });
    }

    // 1) MusicBrainz release-group keresés (első találat elég)
    const q = encodeURIComponent(`releasegroup:"${album}" AND artist:"${artist}"`);
    const mbUrl = `https://musicbrainz.org/ws/2/release-group?query=${q}&fmt=json&limit=1`;

    const mbResp = await fetch(mbUrl, {
      headers: {
        // MusicBrainz kéri a UA-t
        "User-Agent": "ticketdrop-punk500/1.0 (contact: your-email@example.com)"
      }
    });

    if (!mbResp.ok) throw new Error(`MusicBrainz error ${mbResp.status}`);
    const mb = await mbResp.json();
    const rg = (mb["release-groups"] || [])[0];

    let coverUrl = null;

    if (rg && rg.id) {
      // 2) Cover Art Archive JSON → front kép URL
      // pl. https://coverartarchive.org/release-group/<MBID>
      const caaUrl = `https://coverartarchive.org/release-group/${rg.id}`;
      const caaResp = await fetch(caaUrl, { headers: { "User-Agent": "ticketdrop-punk500/1.0 (contact: your-email@example.com)" }});
      if (caaResp.ok) {
        const caa = await caaResp.json();
        // front=true képet keressük, ha több van, az elsőt
        const images = Array.isArray(caa.images) ? caa.images : [];
        const front = images.find(img => img.front) || images[0];
        if (front) {
          // preferált: nagy méret, ha van; különben image
          coverUrl = (front.thumbnails && (front.thumbnails["1200"] || front.thumbnails["1000"] || front.thumbnails["large"])) || front.image;
        }
      }
    }

    const query = encodeURIComponent(`${artist} ${album}`);
    const spotifySearchUrl = `https://open.spotify.com/search/${query}`;
    const ytMusicSearchUrl = `https://music.youtube.com/search?q=${query}`;
    const discogsSearchUrl = `https://www.discogs.com/search/?q=${query}&type=all`;

    return res.status(200).json({
      artist, album, coverUrl,
      links: { spotifySearchUrl, ytMusicSearchUrl, discogsSearchUrl },
      source: "musicbrainz + coverartarchive"
    });
  } catch (e) {
    return res.status(200).json({
      error: String(e),
      coverUrl: null
    });
  }
}
