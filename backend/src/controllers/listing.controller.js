import * as listingService from "../services/listing.service.js";

export async function createListing(req, res, next) {
  try {
    const listing = await listingService.createListing(req.user.id, req.body);
    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
}

export async function getListing(req, res, next) {
  try {
    const listing = await listingService.getListing(req.params.id);
    res.json(listing);
  } catch (err) {
    next(err);
  }
}

export async function updateListing(req, res, next) {
  try {
    const listing = await listingService.updateListing(
      req.params.id,
      req.user.id,
      req.body
    );
    res.json(listing);
  } catch (err) {
    next(err);
  }
}

export async function deleteListing(req, res, next) {
  try {
    await listingService.deleteListing(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listListings(req, res, next) {
  try {
    const { items, nextCursor } = await listingService.listListings(req.query);
    res.json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
}
