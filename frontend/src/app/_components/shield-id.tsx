import classNames from "classnames";

export default function ShieldId({
  shieldId,
  handleUpdateBlacklist,
}: {
  shieldId: bigint;
  handleUpdateBlacklist: (shieldId: bigint) => void;
}) {
  return (
    <div
      className={classNames("cursor-pointer")}
      onClick={handleUpdateBlacklist.bind(null, shieldId)}
    >
      {shieldId.toString()}
    </div>
  );
}
