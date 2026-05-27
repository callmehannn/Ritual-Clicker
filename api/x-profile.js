module.exports = async function handler(request, response) {
  const rawUsername = String(request.query.username || "");
  const username = rawUsername.replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15);
  const token = process.env.X_BEARER_TOKEN;

  response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");

  if (!username) {
    response.status(400).json({ error: "Username is required" });
    return;
  }

  if (!token) {
    response.status(500).json({ error: "Missing X_BEARER_TOKEN in Vercel Environment Variables" });
    return;
  }

  try {
    const userUrl = new URL(`https://api.x.com/2/users/by/username/${username}`);
    userUrl.searchParams.set("user.fields", "name,username,profile_image_url");

    const userResult = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const userPayload = await userResult.json();
    if (!userResult.ok || !userPayload.data) {
      response.status(userResult.status || 404).json({ error: userPayload.detail || "X user not found" });
      return;
    }

    const profile = userPayload.data;
    const avatarUrl = String(profile.profile_image_url || "").replace(/_normal(\.[a-zA-Z0-9]+)$/i, "_400x400$1");
    let avatarDataUrl = "";

    if (avatarUrl) {
      const avatarResult = await fetch(avatarUrl);
      if (avatarResult.ok) {
        const contentType = avatarResult.headers.get("content-type") || "image/jpeg";
        const avatarBuffer = Buffer.from(await avatarResult.arrayBuffer());
        avatarDataUrl = `data:${contentType};base64,${avatarBuffer.toString("base64")}`;
      }
    }

    response.status(200).json({
      name: profile.name || profile.username || username,
      username: profile.username || username,
      profile_image_url: avatarUrl,
      profile_image_data_url: avatarDataUrl,
    });
  } catch (error) {
    response.status(500).json({ error: error.message || "Could not load X profile" });
  }
};
