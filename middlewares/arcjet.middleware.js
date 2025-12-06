import aj from "../config/arcjet.js";
import {
  //isVerifiedBot,
  isSpoofedBot,
  isMissingUserAgent,
} from "@arcjet/inspect";

const arcjetMiddleware = async (req, res, next) => {
  try {
    const decision = await aj.protect(req, { requested: 1 }); // requested :1 means i take away 1 token from the bucket upon every request
    // console.log('Arcjet decision:', decision);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit())
        return res
          .status(429)
          .json({ error: "Too many requests - Rate limit exceeded" });
      if (decision.reason.isBot())
        return res.status(403).json({ error: "bot detected " });

      return res.status(403).json({ error: "Acess denied" });
    }

    if (decision.results.some(isMissingUserAgent)) {
      return res.status(400).json({ error: "You are a bot!" });
    }

    // Block any client pretending to be a search engine bot but using an IP
    // address that doesn't satisfy the verification
    if (decision.results.some(isSpoofedBot)) {
      return res
        .status(403)
        .json({ error: "You are pretending to be a good bot!" });
    }

    next();
  } catch (error) {
    console.error(`Arcjet Middleware Error: ${error}`);
    next(error);
  }
};

export default arcjetMiddleware;
