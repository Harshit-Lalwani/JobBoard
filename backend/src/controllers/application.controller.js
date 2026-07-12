import * as applicationService from "../services/application.service.js";

export async function apply(req, res, next) {
  try {
    const application = await applicationService.apply(req.params.listingId, req.user.id, req.body);
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
}

export async function getApplicationsForListing(req, res, next) {
  try {
    const applications = await applicationService.getApplicationsForListing(
      req.params.listingId,
      req.user.id
    );
    res.json(applications);
  } catch (err) {
    next(err);
  }
}

export async function updateApplicationStatus(req, res, next) {
  try {
    const application = await applicationService.updateApplicationStatus(
      req.params.applicationId,
      req.user.id,
      req.body
    );
    res.json(application);
  } catch (err) {
    next(err);
  }
}

export async function getApplicationById(req, res, next) {
  try {
    const application = await applicationService.getApplicationById(req.params.applicationId);
    res.json(application);
  } catch (err) {
    next(err);
  }
}
