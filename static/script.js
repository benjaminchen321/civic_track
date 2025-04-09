// FILE: static/script.js
// ... (Keep references, other helpers, fetch functions etc. as before) ...

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Loaded.");
  // --- References ---
  const memberSelect = document.getElementById("member-select");
  const memberListLoader = document.getElementById("member-list-loader");
  const memberListError = document.getElementById("member-list-error");
  const congressFilterSelect = document.getElementById("congress-filter");
  const nameSearchInput = document.getElementById("name-search");
  const partyFilters = document.querySelectorAll('input[name="party-filter"]');
  const chamberFilters = document.querySelectorAll(
    'input[name="chamber-filter"]'
  );
  const stateFilterSelect = document.getElementById("state-filter");
  const memberInfoDiv = document.getElementById("member-info");
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const memberPhoto = document.getElementById("member-photo");
  const photoLoadingError = document.getElementById("photo-loading-error");
  const memberDetailsCoreContainer = document.getElementById(
    "member-details-core"
  ); // Corrected name
  const termHistoryList = document.getElementById("term-history-list");
  const partyHistoryList = document.getElementById("party-history-list");
  const leadershipHistoryList = document.getElementById(
    "leadership-history-list"
  );
  const photoAttribution = document.getElementById("photo-attribution");
  const sponsoredItemsList = document.getElementById("sponsored-items-list");
  const sponsoredItemsStatus = document.getElementById(
    "sponsored-items-status"
  );
  const cosponsoredItemsList = document.getElementById(
    "cosponsored-items-list"
  );
  const cosponsoredItemsStatus = document.getElementById(
    "cosponsored-items-status"
  );

  // --- Globals and Constants ---
  let currentFilters = {
    congress: initialCongress || null,
    name: "",
    party: "ALL",
    state: "ALL",
    chamber: "ALL",
  };
  let allMembersData = [];
  const billTypePaths = {
    HR: "house-bill",
    S: "senate-bill",
    HRES: "house-resolution",
    SRES: "senate-resolution",
    HJRES: "house-joint-resolution",
    SJRES: "senate-joint-resolution",
    HCONRES: "house-concurrent-resolution",
    SCONRES: "senate-concurrent-resolution",
    SAMDT: "senate-amendment",
    HAMDT: "house-amendment",
    SA: "senate-amendment",
    HA: "house-amendment",
  };

  // --- Helper Functions (Keep createLegislationListItem, displayError, switchTab as before) ---
  function createLegislationListItem(item) {
    const li = document.createElement("li");
    let el = document.createElement("span");
    el.textContent = "N/A";
    const title = item.title || "No Title";
    const cong = item.congress;
    const typeCode = item.type;
    const num = item.number;
    if (!item) return li;
    if (item.item_type === "Bill" && cong && typeCode && num !== null) {
      let disp = `${typeCode}${num}`;
      const path = billTypePaths[typeCode];
      if (path) {
        const url = `https://www.congress.gov/bill/${cong}th-congress/${path}/${num}`;
        el = document.createElement("a");
        el.href = url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        el.textContent = disp;
      } else {
        el.textContent = disp;
      }
    } else if (
      item.item_type === "Amendment" &&
      cong &&
      typeCode &&
      num !== null
    ) {
      let disp = `${typeCode} ${num}`;
      const path = billTypePaths[typeCode];
      if (path) {
        const url = `https://www.congress.gov/amendment/${cong}th-congress/${path}/${num}`;
        el = document.createElement("a");
        el.href = url;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        el.textContent = disp;
      } else {
        el.textContent = disp;
      }
    } else {
      el.textContent = `Item: ${typeCode || "?"}${num || "?"}`;
      console.warn("Cannot classify:", item);
    }
    li.appendChild(el);
    li.appendChild(document.createTextNode(`: ${title} `));
    if (item.introduced_date) {
      li.appendChild(
        document.createTextNode(`(Intro: ${item.introduced_date}) `)
      );
    }
    if (item.latest_action_text && item.latest_action_text !== "N/A") {
      li.appendChild(
        document.createTextNode(
          `(Action: ${item.latest_action_text} on ${
            item.latest_action_date || "N/A"
          })`
        )
      );
    } else if (item.introduced_date) {
      li.appendChild(document.createTextNode(`(No recent action)`));
    }
    return li;
  }
  function displayError(el, listEl, msg) {
    if (!el) return;
    el.classList.remove("loading");
    el.querySelector(".loader")?.remove();
    if (listEl) listEl.innerHTML = "";
    let errP = el.querySelector(".error-message");
    if (!errP) {
      errP = document.createElement("p");
      errP.className = "error-message";
      el.prepend(errP);
    }
    errP.textContent = msg || "Error.";
    errP.style.display = "block";
  }
  function switchTab(btn) {
    if (!btn || !tabButtons || !tabPanes) return;
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const targetId = btn.getAttribute("data-tab");
    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add("active");
    else {
      tabButtons[0]?.classList.add("active");
      tabPanes[0]?.classList.add("active");
    }
  }

  // --- Fetch Functions (Keep fetchCongressMembers, populateMemberDropdown, fetchMemberDetailData as before) ---
  async function fetchCongressMembers(num) {
    /* ... */ console.log(`Fetching members ${num}...`);
    if (!memberSelect || !memberListLoader || !memberListError) return;
    memberSelect.disabled = true;
    memberListLoader.style.display = "inline-block";
    memberListError.style.display = "none";
    memberSelect.innerHTML = '<option value="">-- Loading --</option>';
    allMembersData = [];
    try {
      const r = await fetch(`/api/members?congress=${num}`);
      if (!r.ok) {
        let msg = `Err: ${r.status}`;
        try {
          const d = await r.json();
          msg = d.error || msg;
        } catch (e) {}
        throw new Error(msg);
      }
      const members = await r.json();
      if (!Array.isArray(members)) throw new Error("Bad format.");
      allMembersData = members;
      console.log(`Fetched ${allMembersData.length}.`);
      memberListLoader.style.display = "none";
      populateMemberDropdown();
    } catch (err) {
      console.error("Fetch members err:", err);
      memberListLoader.style.display = "none";
      memberListError.textContent = `Err: ${err.message}`;
      memberListError.style.display = "inline-block";
      memberSelect.innerHTML = '<option value="">-- Error --</option>';
      allMembersData = [];
      memberSelect.disabled = true;
    }
  }
  function populateMemberDropdown() {
    /* ... */ if (!memberSelect || !memberListError) return;
    memberListError.style.display = "none";
    memberSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "-- Choose --";
    memberSelect.appendChild(opt);
    if (!allMembersData?.length) {
      opt.textContent = "-- None --";
      memberSelect.disabled = true;
      return;
    }
    memberSelect.disabled = false;
    const nF = currentFilters.name.toLowerCase().trim();
    const pF = currentFilters.party;
    const sF = currentFilters.state;
    const cF = currentFilters.chamber;
    console.log(
      `Filtering ${allMembersData.length} C=${currentFilters.congress} P=${pF}, Ch=${cF}, St=${sF}, N=${nF}`
    );
    let count = 0;
    const filt = allMembersData
      .filter((m) => {
        if (!m) return false;
        const nm = !nF || (m.name && m.name.toLowerCase().includes(nF));
        const sm = sF === "ALL" || m.state === sF;
        const chm =
          cF === "ALL" ||
          (m.chamber && m.chamber.toUpperCase() === cF.toUpperCase());
        const pc = m.party_code || "";
        let pm =
          pF === "ALL" || (pF === "ID" ? pc !== "D" && pc !== "R" : pc === pF);
        const pass = nm && sm && pm && chm;
        if (pass) count++;
        return pass;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    console.log(`Passed: ${count}`);
    opt.textContent =
      filt.length === 0 ? "-- No match --" : `-- Select (${filt.length}) --`;
    filt.forEach((m) => {
      if (m?.bioguide_id && m?.name) {
        const o = document.createElement("option");
        o.value = m.bioguide_id;
        o.textContent = m.name;
        memberSelect.appendChild(o);
      }
    });
  }
  async function fetchMemberDetailData(id) {
    /* ... */ if (!memberInfoDiv || !id) {
      clearData();
      return;
    }
    console.log(`Fetching details ${id}...`);
    memberInfoDiv.classList.remove("hidden");
    tabButtons[0] && switchTab(tabButtons[0]);
    if (memberDetailsCoreContainer) {
      memberDetailsCoreContainer.innerHTML = "";
      memberDetailsCoreContainer.classList.add("loading");
    }
    if (memberPhoto) memberPhoto.style.display = "none";
    if (photoLoadingError) photoLoadingError.style.display = "none";
    if (photoAttribution) photoAttribution.textContent = "";
    if (termHistoryList) termHistoryList.innerHTML = "";
    if (partyHistoryList) partyHistoryList.innerHTML = "";
    if (leadershipHistoryList) leadershipHistoryList.innerHTML = "";
    if (sponsoredItemsStatus) {
      sponsoredItemsStatus.classList.add("loading");
      sponsoredItemsList && (sponsoredItemsList.innerHTML = "");
    }
    if (cosponsoredItemsStatus) {
      cosponsoredItemsStatus.classList.add("loading");
      cosponsoredItemsList && (cosponsoredItemsList.innerHTML = "");
    }
    [
      sponsoredItemsStatus,
      cosponsoredItemsStatus,
      memberDetailsCoreContainer,
    ].forEach((div) => div?.querySelector(".error-message")?.remove());
    photoLoadingError.parentNode
      ?.querySelectorAll(".error-message")
      .forEach((e) => e.remove());
    photoLoadingError.style.display = "none";
    const url = `/api/member/${id}`;
    let data = null;
    try {
      const r = await fetch(url);
      data = await r.json();
      console.log("Detail recv:", data);
      if (!r.ok) {
        const msg =
          data?.error || data?.member_details_error || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      if (!data) throw new Error("Invalid resp.");
      if (memberDetailsCoreContainer)
        memberDetailsCoreContainer.classList.remove("loading");
      if (sponsoredItemsStatus)
        sponsoredItemsStatus.classList.remove("loading");
      if (cosponsoredItemsStatus)
        cosponsoredItemsStatus.classList.remove("loading");
      updateDisplay(data);
    } catch (err) {
      console.error("Fetch detail err:", err);
      if (memberDetailsCoreContainer)
        memberDetailsCoreContainer.classList.remove("loading");
      if (sponsoredItemsStatus)
        sponsoredItemsStatus.classList.remove("loading");
      if (cosponsoredItemsStatus)
        cosponsoredItemsStatus.classList.remove("loading");
      if (memberDetailsCoreContainer) {
        displayError(
          memberDetailsCoreContainer,
          null,
          `Details Err: ${err.message}`
        );
      } else {
        alert(`Err: ${err.message}`);
      }
      displayError(
        sponsoredItemsStatus,
        sponsoredItemsList,
        data?.sponsored_items_error || "Sponsored Err."
      );
      displayError(
        cosponsoredItemsStatus,
        cosponsoredItemsList,
        data?.cosponsored_items_error || "Cosponsored Err."
      );
      if (memberPhoto) memberPhoto.style.display = "none";
      if (photoLoadingError) photoLoadingError.style.display = "none";
    }
  }

  // --- Function to update the display (Member Details & History) ---
  function updateDisplay(data) {
    console.log("Updating member display START");
    if (!data || typeof data !== "object") {
      console.error("updateDisplay invalid data");
      return;
    }

    const details = data.member_details;

    // Clear previous history content
    if (termHistoryList) termHistoryList.innerHTML = "";
    if (partyHistoryList) partyHistoryList.innerHTML = "";
    if (leadershipHistoryList) leadershipHistoryList.innerHTML = "";
    if (photoAttribution) photoAttribution.textContent = "";

    if (details && typeof details === "object" && memberDetailsCoreContainer) {
      memberDetailsCoreContainer.style.display = "grid"; // Ensure grid

      // --- Determine Honorific & Latest Term Info ---
      let honorific = details.honorificName ? `${details.honorificName}. ` : ""; // Use honorificName if provided
      let latestTermInfo = null;
      let latestChamber = null;
      if (
        details.terms &&
        Array.isArray(details.terms) &&
        details.terms.length > 0
      ) {
        details.terms.sort(
          (a, b) =>
            (b.congress || 0) - (a.congress || 0) ||
            (b.startYear || 0) - (a.startYear || 0)
        );
        latestTermInfo = details.terms[0];
        latestChamber = latestTermInfo?.chamber; // Get chamber from latest term
        // Determine honorific based on LATEST term's chamber if not directly provided
        if (!honorific && latestChamber) {
          if (latestChamber === "Senate") honorific = "Sen. ";
          else if (latestChamber === "House") honorific = "Rep. ";
        }
      }

      // --- Core Details ---
      let coreDetailsHtml = "";
      const displayName = honorific + (details.name || "N/A");
      coreDetailsHtml += `<strong>Name:</strong><span>${displayName}</span>`;

      let infoLine = "";
      if (details.state) infoLine += `${details.state}`; // Use state from main details
      const latestParty =
        details.partyHistory?.length > 0
          ? details.partyHistory[details.partyHistory.length - 1]?.partyName
          : details.party;
      if (latestParty)
        infoLine += `${infoLine ? " | " : ""}${latestParty || "N/A"}`;
      if (latestChamber) infoLine += `${infoLine ? " | " : ""}${latestChamber}`; // Use chamber from latest term
      if (infoLine)
        coreDetailsHtml += `<strong>Info:</strong><span>${infoLine}</span>`;
      if (details.birth_year)
        coreDetailsHtml += `<strong>Born:</strong><span>${details.birth_year}</span>`;
      if (details.website_url) {
        /* (keep website logic as before) */ let safeUrl =
          details.website_url.trim();
        if (safeUrl && !safeUrl.startsWith("http"))
          safeUrl = "https://" + safeUrl;
        try {
          new URL(safeUrl);
          coreDetailsHtml += `<strong>Website:</strong><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Official Website</a>`;
        } catch (_) {
          coreDetailsHtml += `<strong>Website:</strong><span>(Invalid URL)</span>`;
        }
      }
      if (data.member_details_error) {
        coreDetailsHtml += `<p class="error-message">${data.member_details_error}</p>`;
        memberDetailsCoreContainer.style.display = "block";
      }
      memberDetailsCoreContainer.innerHTML = coreDetailsHtml;

      // --- Term History ---
      if (termHistoryList && details.terms && details.terms.length > 0) {
        details.terms.forEach((term) => {
          // Already sorted
          const li = document.createElement("li");
          const termYears = `${term.startYear || "?"} - ${
            term.endYear || "Present"
          }`;
          // --- *** Use term.stateName *** ---
          const location = term.district
            ? `${term.stateName || "?"} (Dist. ${term.district})`
            : term.stateName || "?";
          // --- *** ---
          li.innerHTML = `<strong>${
            term.congress || "?"
          }th Congress</strong> (${termYears})<br><span>${
            term.chamber || "?"
          } - ${location}</span>`;
          termHistoryList.appendChild(li);
        });
      } else if (termHistoryList) {
        termHistoryList.innerHTML = "<li>No term history available.</li>";
      }

      // --- Party History ---
      if (
        partyHistoryList &&
        details.partyHistory &&
        details.partyHistory.length > 0
      ) {
        details.partyHistory.sort(
          (a, b) => (b.startYear || 0) - (a.startYear || 0)
        ); // Sort by start year desc
        details.partyHistory.forEach((p) => {
          const li = document.createElement("li");
          // Use startYear and endYear if available
          const dateRange =
            p.startYear && p.endYear
              ? `${p.startYear} - ${p.endYear}`
              : p.startYear
              ? `${p.startYear} - Present`
              : "? - ?";
          li.innerHTML = `<strong>${
            p.partyName || "?"
          }</strong> <span>(${dateRange})</span>`;
          partyHistoryList.appendChild(li);
        });
      } else if (partyHistoryList) {
        partyHistoryList.innerHTML = "<li>No party history available.</li>";
      }

      // --- Leadership History ---
      if (
        leadershipHistoryList &&
        details.leadership &&
        details.leadership.length > 0
      ) {
        // Sort by congress desc, then potential start date
        details.leadership.sort(
          (a, b) =>
            (b.congress || 0) - (a.congress || 0) ||
            (b.startDate || "").localeCompare(a.startDate || "")
        );
        details.leadership.forEach((l) => {
          const li = document.createElement("li");
          // Check for start/end date, otherwise just show congress
          const dateInfo =
            l.startDate && l.endDate
              ? `${l.startDate} - ${l.endDate}`
              : l.startDate
              ? `${l.startDate} - Present`
              : "";
          li.innerHTML =
            `<strong>${l.type || "?"}</strong> (Congress ${
              l.congress || "?"
            })` + (dateInfo ? `<br><span>${dateInfo}</span>` : "");
          leadershipHistoryList.appendChild(li);
        });
      } else if (leadershipHistoryList) {
        leadershipHistoryList.innerHTML =
          "<li>No leadership history available.</li>";
      }

      // --- Photo & Attribution ---
      let imageUrl = `https://bioguide.congress.gov/bioguide/photo/${details.bioguide_id[0]}/${details.bioguide_id}.jpg`;
      let attributionText = "";
      if (details.depiction?.imageUrl) {
        imageUrl = details.depiction.imageUrl;
        attributionText = details.depiction.attribution || "";
      }
      if (details.bioguide_id && memberPhoto && photoLoadingError) {
        memberPhoto.src = imageUrl;
        memberPhoto.alt = `Photo of ${details.name || "member"}`;
        memberPhoto.style.display = "block";
        photoLoadingError.style.display = "none";
        if (photoAttribution) photoAttribution.innerHTML = attributionText; // Use innerHTML for attribution link
        memberPhoto.onerror = () => {
          memberPhoto.style.display = "none";
          photoLoadingError.textContent = "No photo";
          photoLoadingError.style.display = "block";
          memberPhoto.onerror = null;
          if (photoAttribution) photoAttribution.textContent = "";
        };
        memberPhoto.onload = () => {
          photoLoadingError.style.display = "none";
          memberPhoto.onerror = null;
        };
      } else {
        if (memberPhoto) memberPhoto.style.display = "none";
        if (photoLoadingError) {
          photoLoadingError.textContent = details.bioguide_id
            ? "No photo"
            : "ID missing";
          photoLoadingError.style.display = "block";
        }
        if (photoAttribution) photoAttribution.textContent = "";
      }
    } else {
      // Handle missing 'details'
      if (memberDetailsCoreContainer) {
        memberDetailsCoreContainer.style.display = "block";
        displayError(
          memberDetailsCoreContainer,
          null,
          data.member_details_error || "Details unavailable."
        );
      }
      if (memberPhoto) memberPhoto.style.display = "none";
      if (photoLoadingError) photoLoadingError.style.display = "none";
      if (photoAttribution) photoAttribution.textContent = "";
      if (termHistoryList)
        termHistoryList.innerHTML = "<li>Err loading history.</li>";
      if (partyHistoryList)
        partyHistoryList.innerHTML = "<li>Err loading history.</li>";
      if (leadershipHistoryList)
        leadershipHistoryList.innerHTML = "<li>Err loading history.</li>";
    }
    console.log("Member details, photo & history updated.");

    // --- Legislation Tabs (Keep as before) ---
    const sponsoredCountSpan = document.getElementById("sponsored-count");
    const cosponsoredCountSpan = document.getElementById("cosponsored-count");
    if (sponsoredCountSpan)
      sponsoredCountSpan.textContent =
        data.sponsored_count !== undefined ? `(${data.sponsored_count})` : "";
    if (cosponsoredCountSpan)
      cosponsoredCountSpan.textContent =
        data.cosponsored_count !== undefined
          ? `(${data.cosponsored_count})`
          : "";
    [sponsoredItemsStatus, cosponsoredItemsStatus].forEach((sEl, i) => {
      const lEl = i === 0 ? sponsoredItemsList : cosponsoredItemsList;
      const items = i === 0 ? data.sponsored_items : data.cosponsored_items;
      const err =
        i === 0 ? data.sponsored_items_error : data.cosponsored_items_error;
      const t = i === 0 ? "sponsored" : "cosponsored";
      if (lEl && sEl) {
        lEl.innerHTML = "";
        sEl.querySelector(".error-message")?.remove();
        if (err) {
          displayError(sEl, lEl, err);
        } else if (items?.length > 0) {
          try {
            items.forEach((item) => {
              if (item) lEl.appendChild(createLegislationListItem(item));
            });
          } catch (e) {
            displayError(sEl, lEl, `Err displaying ${t}.`);
          }
        } else {
          lEl.innerHTML = `<li>No recent ${t}.</li>`;
        }
      }
    });
    console.log("Display update END");
  }

  function clearData() {
    if (memberInfoDiv) memberInfoDiv.classList.add("hidden");
    if (memberDetailsCoreContainer) {
      memberDetailsCoreContainer.innerHTML = "<p>Select member</p>";
      memberDetailsCoreContainer.classList.remove("loading");
      memberDetailsCoreContainer.querySelector(".error-message")?.remove();
      memberDetailsCoreContainer.style.display = "block";
    }
    if (termHistoryList) termHistoryList.innerHTML = "";
    if (partyHistoryList) partyHistoryList.innerHTML = "";
    if (leadershipHistoryList) leadershipHistoryList.innerHTML = "";
    if (memberPhoto) {
      memberPhoto.style.display = "none";
      memberPhoto.src = "";
    }
    if (photoLoadingError) {
      photoLoadingError.style.display = "none";
      photoLoadingError.parentNode
        ?.querySelectorAll(".error-message")
        .forEach((e) => e.remove());
    }
    if (photoAttribution) photoAttribution.textContent = "";
    [sponsoredItemsStatus, cosponsoredItemsStatus].forEach((div) => {
      if (div) {
        div.classList.remove("loading");
        div.querySelector(".error-message")?.remove();
      }
    });
    if (sponsoredItemsList)
      sponsoredItemsList.innerHTML = "<li>Select member</li>";
    if (cosponsoredItemsList)
      cosponsoredItemsList.innerHTML = "<li>Select member</li>";
    if (tabButtons?.length > 0) switchTab(tabButtons[0]);
    document
      .querySelectorAll(".item-count")
      .forEach((c) => (c.textContent = ""));
  }

  // --- Event Listeners & Initial Load (Keep exactly as before) ---
  if (congressFilterSelect)
    congressFilterSelect.addEventListener("change", (e) => {
      const c = e.target.value;
      if (!c) {
        memberSelect.innerHTML =
          '<option value="">-- Select Congress --</option>';
        memberSelect.disabled = true;
        clearData();
        return;
      }
      currentFilters.congress = c;
      clearData();
      memberSelect.value = "";
      fetchCongressMembers(c);
    });
  if (memberSelect)
    memberSelect.addEventListener("change", (e) => {
      fetchMemberDetailData(e.target.value);
    });
  if (nameSearchInput) {
    let dt;
    nameSearchInput.addEventListener("input", (e) => {
      clearTimeout(dt);
      dt = setTimeout(() => {
        currentFilters.name = e.target.value;
        populateMemberDropdown();
        memberSelect.value = "";
        if (!memberInfoDiv?.classList.contains("hidden")) clearData();
      }, 300);
    });
  }
  if (partyFilters.length > 0)
    partyFilters.forEach((r) =>
      r.addEventListener("change", (e) => {
        if (e.target.checked) {
          currentFilters.party = e.target.value;
          populateMemberDropdown();
          memberSelect.value = "";
          if (!memberInfoDiv?.classList.contains("hidden")) clearData();
        }
      })
    );
  if (chamberFilters.length > 0)
    chamberFilters.forEach((r) =>
      r.addEventListener("change", (e) => {
        if (e.target.checked) {
          currentFilters.chamber = e.target.value;
          populateMemberDropdown();
          memberSelect.value = "";
          if (!memberInfoDiv?.classList.contains("hidden")) clearData();
        }
      })
    );
  if (stateFilterSelect)
    stateFilterSelect.addEventListener("change", (e) => {
      currentFilters.state = e.target.value;
      populateMemberDropdown();
      memberSelect.value = "";
      if (!memberInfoDiv?.classList.contains("hidden")) clearData();
    });
  if (tabButtons.length > 0)
    tabButtons.forEach((b) => b.addEventListener("click", () => switchTab(b)));
  clearData();
  const initialCongressValue = congressFilterSelect
    ? congressFilterSelect.value
    : null;
  if (initialCongressValue) {
    currentFilters.congress = initialCongressValue;
    fetchCongressMembers(initialCongressValue);
  } else {
    memberSelect.innerHTML = '<option value="">-- Select Congress --</option>';
    memberSelect.disabled = true;
  }
}); // End DOMContentLoaded
