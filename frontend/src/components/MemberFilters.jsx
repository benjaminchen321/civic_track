// FILE: frontend/src/components/MemberFilters.jsx
import React from "react";

// Mock data passed down for now
const MOCK_CONGRESSES = [{ number: 118 }, { number: 117 }];
const MOCK_STATES = ["All", "Alabama", "Alaska", "Arizona"];
const MOCK_CHAMBERS = ["All", "House", "Senate"];

function MemberFilters({
  congresses = MOCK_CONGRESSES, // Default to mock
  states = MOCK_STATES,
  chambers = MOCK_CHAMBERS,
  currentCongress,
  filters,
  onCongressChange,
  onFilterChange,
  isLoading, // To disable filters while loading members
}) {
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const handleRadioChange = (event) => {
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };

  // Debounce for name input
  const handleNameChange = (event) => {
    // TODO: Implement debounce if desired
    const { name, value } = event.target;
    onFilterChange({ ...filters, [name]: value });
  };

  return (
    <div className="member-filters-react">
      {" "}
      {/* Add styles later */}
      <h4>Filter Members</h4>
      <div className="filter-group">
        <label htmlFor="congress-filter">Congress:</label>
        <select
          id="congress-filter"
          value={currentCongress}
          onChange={onCongressChange} // Special handler passed down
          disabled={isLoading}
        >
          {/* <option value="">Select Congress</option> */}
          {congresses.map((c) => (
            <option key={c.number} value={c.number}>
              {c.number}
              {c.startYear && c.endYear ? ` (${c.startYear}-${c.endYear})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label htmlFor="name-search">Name:</label>
        <input
          type="text"
          id="name-search"
          name="name"
          placeholder="Enter name..."
          value={filters.name}
          onChange={handleNameChange} // Use debounced handler later
          disabled={isLoading}
        />
      </div>
      <div className="filter-group">
        <span className="filter-label">Party:</span>
        <label>
          <input
            type="radio"
            name="party"
            value="ALL"
            checked={filters.party === "ALL"}
            onChange={handleRadioChange}
            disabled={isLoading}
          />{" "}
          All
        </label>
        <label>
          <input
            type="radio"
            name="party"
            value="D"
            checked={filters.party === "D"}
            onChange={handleRadioChange}
            disabled={isLoading}
          />{" "}
          Dem
        </label>
        <label>
          <input
            type="radio"
            name="party"
            value="R"
            checked={filters.party === "R"}
            onChange={handleRadioChange}
            disabled={isLoading}
          />{" "}
          Rep
        </label>
        <label>
          <input
            type="radio"
            name="party"
            value="ID"
            checked={filters.party === "ID"}
            onChange={handleRadioChange}
            disabled={isLoading}
          />{" "}
          Other
        </label>
      </div>
      <div className="filter-group">
        <span className="filter-label">Chamber:</span>
        <label>
          <input
            type="radio"
            name="chamber"
            value="ALL"
            checked={filters.chamber === "ALL"}
            onChange={handleRadioChange}
            disabled={isLoading}
          />{" "}
          All
        </label>
        {chambers.map((ch) => (
          <label key={ch}>
            <input
              type="radio"
              name="chamber"
              value={ch}
              checked={filters.chamber === ch}
              onChange={handleRadioChange}
              disabled={isLoading}
            />{" "}
            {ch}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <label htmlFor="state-filter">State:</label>
        <select
          id="state-filter"
          name="state"
          value={filters.state}
          onChange={handleInputChange}
          disabled={isLoading}
        >
          <option value="ALL">All States</option>
          {states.map((s_name) => (
            <option key={s_name} value={s_name}>
              {s_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default MemberFilters;
