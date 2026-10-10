
    const list = document.getElementById("business-list");
    const search = document.getElementById("search");
    const status = document.getElementById("status");

    document.getElementById("year").textContent =
      new Date().getFullYear();

    let businesses = [];

    function safeWebsite(value) {
      if (!value) return "";

      try {
        const url = new URL(value);

        if (url.protocol === "https:" || url.protocol === "http:") {
          return url.href;
        }
      } catch (error) {
        return "";
      }

      return "";
    }



function populateFilter(selectId, values, defaultLabel) {
  const select = document.getElementById(selectId);
  const previousValue = select.value;

  select.replaceChildren();

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = defaultLabel;
  select.appendChild(firstOption);

  [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

  if ([...select.options].some(option => option.value === previousValue)) {
    select.value = previousValue;
  }
}

function renderBusinesses() {
  const query = search.value.trim().toLowerCase();
    const country = document.getElementById("country-filter").value;
  const city = document.getElementById("city-filter").value;
  const category = document.getElementById("category-filter").value;
  const filtered = businesses.filter(business => {
    const searchable = [
      business.business_name,
      business.country,
      business.city,
      business.category,
      business.description
    ].join(" ").toLowerCase();

    return searchable.includes(query)
      && (!country || business.country === country)
      && (!city || business.city === city)
      && (!category || business.category === category);
  });

  list.replaceChildren();

  if (filtered.length === 0) {
    status.textContent = businesses.length === 0
      ? "No businesses have been registered yet."
      : "No businesses match your search or filters.";
    return;
  }

  status.textContent = "Showing " + filtered.length + " business(es).";

  filtered.forEach(business => {
    const card = document.createElement("article");
    card.className = "business-card";

    const title = document.createElement("h2");
    title.textContent = business.business_name;

    const categoryLabel = document.createElement("span");
    categoryLabel.className = "category";
    categoryLabel.textContent = business.category;

    const location = document.createElement("p");
    location.textContent = "📍 " + business.city + ", " + business.country;

    const description = document.createElement("p");
    description.textContent = business.description;

    card.append(title, categoryLabel, location, description);

    const website = safeWebsite(business.website);

    if (website) {
      const link = document.createElement("a");
      link.className = "website";
      link.href = website;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Visit business website";
      card.appendChild(link);
    }

    list.appendChild(card);
  });
}
    async function loadBusinesses() {
      try {
        const response = await fetch("/api/businesses");

        if (!response.ok) {
          throw new Error("Could not load business listings.");
        }

        const data = await response.json();
               businesses = Array.isArray(data.businesses)
          ? data.businesses
          : [];

        populateFilter(
          "country-filter",
          businesses.map(b => b.country),
          "All countries"
        );

        populateFilter(
          "city-filter",
          businesses.map(b => b.city),
          "All cities"
        );

        populateFilter(
          "category-filter",
          businesses.map(b => b.category),
          "All categories"
        );        renderBusinesses();
      } catch (error) {
        status.textContent =
          "Unable to load businesses. Please try again later.";
      }
    }

    search.addEventListener("input", renderBusinesses);
document.getElementById("country-filter")
  .addEventListener("change", renderBusinesses);

document.getElementById("city-filter")
  .addEventListener("change", renderBusinesses);

document.getElementById("category-filter")
  .addEventListener("change", renderBusinesses);
    loadBusinesses();
  