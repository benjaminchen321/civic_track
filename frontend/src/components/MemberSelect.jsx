// FILE: frontend/src/components/MemberSelect.jsx
import React from "react";

function MemberSelect({
  members, // The filtered list of members
  selectedMemberBioguide,
  onMemberSelect,
  isLoading,
  error,
  selectRef, // Pass the ref down
}) {
  const handleSelectChange = (event) => {
    onMemberSelect(event.target.value); // Pass selected bioguide ID up
  };

  let options;
  if (isLoading) {
    options = <option value="">-- Loading Members --</option>;
  } else if (error) {
    options = <option value="">-- Error Loading --</option>;
  } else if (members.length === 0) {
    options = <option value="">-- No Matching Members --</option>;
  } else {
    options = (
      <>
        <option value="">-- Select Member ({members.length}) --</option>
        {members.map((m) => (
          <option key={m.bioguide_id} value={m.bioguide_id}>
            {m.name}
            {m.party_code && m.state ? ` (${m.party_code}-${m.state})` : ""}
          </option>
        ))}
      </>
    );
  }

  return (
    <div className="member-select-react">
      {" "}
      {/* Add styles later */}
      <label htmlFor="member-select-dropdown">Member:</label>
      <select
        id="member-select-dropdown"
        value={selectedMemberBioguide}
        onChange={handleSelectChange}
        disabled={isLoading || error || members.length === 0}
        ref={selectRef} // Attach the ref here
      >
        {options}
      </select>
      {/* Add loader/error indicators specifically for the list here if desired */}
    </div>
  );
}

export default MemberSelect;
